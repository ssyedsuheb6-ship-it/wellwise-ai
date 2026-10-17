
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      question?: string;
      product?: {
        name?: string;
        directions?: string | null;
        precautions?: string | null;
        expected_results?: string | null;
        source_url?: string | null;
        review_status?: string;
      } | null;
    };

    const question = body.question?.trim();

    if (!question || question.length > 1200) {
      return NextResponse.json(
        { error: 'Enter a question of up to 1,200 characters.' },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'The AI service is not configured. Please try again later.' },
        { status: 503 },
      );
    }

    const p = body.product;

    const context = JSON.stringify({
      name: p?.name || 'No product selected',
      directions: p?.directions || 'Not available in verified catalogue',
      precautions: p?.precautions || 'Not available in verified catalogue',
      expected_results: p?.expected_results || 'Not available in verified catalogue',
      source_url: p?.source_url || null,
      review_status: p?.review_status || 'unavailable',
    });

    const systemInstruction =
      'You are WELLWISE AI, a careful product-guidance assistant. ' +
      'You are not a clinician. Never diagnose, prescribe, guarantee outcomes, ' +
      'or invent product directions, ingredients, timelines or claims. ' +
      'Use only supplied context for product-specific statements. ' +
      'If information is missing, say it is unavailable in the verified catalogue. ' +
      'Distinguish verified facts from general explanations. ' +
      'Do not encourage buying more products. For severe or rapidly worsening ' +
      'symptoms, advise seeking appropriate urgent medical care. Use plain English. ' +
      'Do not claim brand endorsement. Product context: ' + context;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: question }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[WELLWISE Gemini API error]', response.status, errorBody);

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'The free AI usage limit may have been reached. Please try again later.' },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: 'The AI service could not complete the request. Please try again later.' },
        { status: 502 },
      );
    }

    const result = await response.json();

    const answer = result.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('')
      .trim();

    if (!answer) {
      return NextResponse.json(
        { error: 'No answer returned. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      answer,
      sourceUrl: p?.source_url || null,
    });
  } catch (error: unknown) {
    console.error(
      '[WELLWISE assistant API error]',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return NextResponse.json(
      { error: 'The assistant could not complete the request. Please try again.' },
      { status: 500 },
    );
  }
}

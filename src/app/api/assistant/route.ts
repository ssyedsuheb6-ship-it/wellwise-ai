import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
export async function POST(req:NextRequest){try{const body=await req.json() as {question?:string;product?:{name?:string;directions?:string|null;precautions?:string|null;expected_results?:string|null;source_url?:string|null;review_status?:string}|null};const question=body.question?.trim();if(!question||question.length>1200)return NextResponse.json({error:'Enter a question of up to 1,200 characters.'},{status:400});if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'Live AI answers are temporarily unavailable because API credits are not available. You can still browse verified product guidance and use My Check-ins.'},{status:503});const p=body.product;const context=JSON.stringify({name:p?.name||'No product selected',directions:p?.directions||'Not available in verified catalogue',precautions:p?.precautions||'Not available in verified catalogue',expected_results:p?.expected_results||'Not available in verified catalogue',source_url:p?.source_url||null,review_status:p?.review_status||'unavailable'});const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});const result=await client.chat.completions.create({model:process.env.OPENAI_MODEL||'gpt-4o-mini',temperature:0.2,messages:[{role:'system',content:'You are WELLWISE AI, a careful product-guidance assistant. You are not a clinician. Never diagnose, prescribe, guarantee outcomes, or invent product directions, ingredients, timelines or claims. Use only supplied context for product-specific statements. If information is missing, say it is unavailable in the verified catalogue. Distinguish verified facts from general explanations. Do not encourage buying more products. For severe or rapidly worsening symptoms, advise seeking appropriate urgent medical care. Use plain English. Do not claim brand endorsement. Product context: '+context},{role:'user',content:question}]});const answer=result.choices[0]?.message?.content?.trim();if(!answer)return NextResponse.json({error:'No answer returned. Please try again.'},{status:502});return NextResponse.json({answer,sourceUrl:p?.source_url||null})} catch (error: unknown) {
  if (error instanceof OpenAI.APIError) {
    console.error('[WELLWISE assistant API error]', {
      status: error.status,
      code: error.code,
      type: error.type,
      message: error.message,
    });

    if (
      error.code === 'credit_balance_exhausted' ||
      (error.status === 429 && error.type === 'insufficient_quota')
    ) {
      return NextResponse.json(
        {
          error:
            'Live AI answers are temporarily unavailable because API credits are not available. You can still browse verified product guidance and use My Check-ins.',
        },
        { status: 503 },
      );
    }
  } else {
    console.error(
      '[WELLWISE assistant API error]',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }

  return NextResponse.json(
    { error: 'The assistant could not complete the request. Please try again.' },
    { status: 500 },
  );
}
}

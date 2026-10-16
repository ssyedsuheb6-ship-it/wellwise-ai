# WELLWISE AI starter project

A working Next.js/TypeScript application foundation. It is an honest first build, not yet a fully launched commercial service.

## What works in this build
- Responsive navigation across Product Guidance, My Check-ins, Ask WELLWISE and About.
- Product catalogue reads only `verified` entries from Supabase when configured.
- Honest empty catalogue state; no invented product information is seeded.
- Browser-local check-ins with save, history and delete. These do not sync to other devices or upload to a server.
- Server-side AI endpoint with safety instructions and a clear error when no API key is configured.
- Privacy and non-endorsement disclosures.

## Not implemented yet
- Account sign-in, admin publishing interface, server-persisted user check-ins, live aggregated insights dashboard, automated browser tests and deployment. Do not describe these as complete.

## Windows setup
1. Install Node.js LTS from https://nodejs.org/en/download.
2. Extract this ZIP to a folder you can find, such as `C:\\Users\\YourName\\Documents\\WELLWISE_AI`.
3. Open Codex and open the extracted project folder.
4. Open a terminal in that folder and run `npm install`.
5. Run `npm run dev`.
6. Open `http://localhost:3000` in your browser.

If PowerShell says `npm` is not recognised, close and reopen the terminal after installing Node.js. Do not paste API keys into chat or source files.

## Supabase catalogue setup
1. Create a project at https://supabase.com.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Add your Supabase project URL and publishable/anon key to the two `NEXT_PUBLIC_SUPABASE_...` variables.
5. Restart the development server.

The catalogue remains empty until you add verified product entries. Only mark an entry `verified` after checking the exact product/variant and its directions, precautions and source. No fake product rows are included.

## Enable AI
Add a valid provider API key as `OPENAI_API_KEY` in `.env.local`, optionally set `OPENAI_MODEL`, and restart the server. Never use a `NEXT_PUBLIC_` prefix for the secret. API calls may incur charges. Without a key, the assistant explains that it is not configured.

## Deployment comes later
Push to GitHub, import the repository into Vercel, add environment variables in Vercel project settings, configure Supabase, and deploy. A localhost URL is not a public submission URL. Test the deployed URL after publishing.

## Before public submission
- Add only source-verified product guidance.
- Decide and implement whether check-ins remain browser-local or become authenticated server-side records.
- Implement account authentication before offering cross-device profiles.
- Create a trusted admin publishing workflow; never expose admin credentials to the browser.
- Add a privacy policy appropriate to actual practices.
- Test the app on mobile, check error states, and review database permissions.
- Conduct real user testing before claiming any improvement.

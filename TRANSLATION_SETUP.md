# Translation Setup Guide

## Environment Variables

Add these to your `.env.local` file:

```bash
# Translation Provider: 'none' or 'openai'
TRANSLATION_PROVIDER=openai

# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-api-key-here

# OpenAI Translation Model (optional, defaults to gpt-4o-mini)
OPENAI_TRANSLATION_MODEL=gpt-4o-mini
```

## How It Works

1. **Language Detection**: Automatically detects if text is Arabic or English using Unicode detection
2. **Translation**: If Arabic and `TRANSLATION_PROVIDER=openai`, translates to English using OpenAI
3. **Fallback**: If translation fails or provider is 'none', stores original text in `detailsEn` for consistency
4. **Short Text Guard**: Skips translation for text < 6 characters to avoid unnecessary API calls

## Testing

1. Create a PX visit with Arabic details: "تأخر في إعطاء الدواء"
2. Verify DB record has:
   - `detailsLang="ar"`
   - `detailsEn="Delay in administering the medication"` (or similar)
3. Create a PX visit with English details and verify `detailsEn === detailsOriginal`

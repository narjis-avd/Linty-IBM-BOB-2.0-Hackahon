# 🚀 Quick Start Guide - AI Code Forge

Get started with AI Code Forge in under 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Get IBM watsonx API Key

1. Go to [IBM Cloud](https://cloud.ibm.com)
2. Sign up or log in
3. Navigate to **watsonx.ai** service
4. Click **Create API key**
5. Copy your API key

## Step 3: Create Project ID

1. In watsonx.ai, create a new project
2. Get your **Project ID**
3. Copy it

## Step 4: Set Environment Variables

Create a `.env` file in the root directory:

```bash
WATSONX_API_KEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here
```

Optional: Use other IBM Cloud regions
```bash
WATSONX_URL=https://eu-de.ml.cloud.ibm.com  # Europe
WATSONX_URL=https://us-south.ml.cloud.ibm.com  # US South (default)
WATSONX_URL=https://au-syd.ml.cloud.ibm.com  # Australia
```

## Step 5: Start the Server

```bash
npm run dev
```

## Step 6: Open in Browser

Go to [http://localhost:3000](http://localhost:3000)

## That's It! 🎉

You now have a fully functional multi-agent AI code analysis system!

## Try It Out

1. Look at the sample code in the editor (it has intentional bugs)
2. Click **"Run AI Analysis"**
3. Watch the 4 agents work in sequence:
   - 🔍 Analyzer detects issues
   - 🛠️ Fixer applies fixes
   - ✅ Tester generates tests
   - 📊 Reporter creates report
4. Explore the 4 tabs:
   - **Issues**: See detected problems
   - **Fixed Code**: Compare before/after
   - **Tests**: Generated test cases
   - **Report**: Comprehensive analysis

## Common Issues

### "Failed to authenticate with IBM watsonx"
- Verify your API key is correct
- Check you're signed into IBM Cloud
- Generate a new API key

### "Missing required environment variables"
- Ensure `.env` file exists in root
- Check variable names match exactly
- No spaces in values

### "Analysis failed"
- Reduce code size (under 100KB)
- Check your internet connection
- Verify IBM watsonx service is active

## Next Steps

- Read [SETUP.md](SETUP.md) for detailed documentation
- Customize the dark theme colors
- Add more sample code
- Deploy to production (Vercel, Netlify, etc.)

## Need Help?

- Check [SETUP.md](SETUP.md) for full documentation
- Review IBM watsonx API docs
- Open an issue on GitHub

---

**Happy Analyzing! 🚀**

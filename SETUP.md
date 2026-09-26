# AI Code Forge - Setup & Documentation

A production-level multi-agent AI code analysis system that detects bugs, fixes them, generates tests, and produces comprehensive reports.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- IBM watsonx API key (free tier available)

### Installation Steps

1. **Clone or navigate to the project directory**
   ```bash
   cd ReplicaForge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up IBM watsonx API credentials**

   Create a `.env` file in the root directory:

   ```bash
   WATSONX_API_KEY=your_api_key_here
   WATSONX_URL=https://us-south.ml.cloud.ibm.com
   WATSONX_PROJECT_ID=your_project_id_here
   WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
   ```

   **Getting IBM watsonx API Key:**
   - Go to [IBM Cloud](https://cloud.ibm.com)
   - Create an account or sign in
   - Navigate to the watsonx.ai service
   - Generate an API key
   - Create a project and get the project ID
   - Use `ibm/granite-13b-chat-v2` or another available model ID

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture

### Multi-Agent System

The system uses 4 specialized AI agents working in sequence:

1. **Analyzer Agent**
   - Deep code analysis
   - Bug detection
   - Complexity metrics
   - Security vulnerability identification

2. **Fixer Agent**
   - Automatic bug fixing
   - Code improvement suggestions
   - Minimal changes approach

3. **Tester Agent**
   - Test case generation
   - Unit, integration, and edge-case tests
   - Test framework configuration

4. **Reporter Agent**
   - Comprehensive analysis report
   - Score breakdown
   - Recommendations
   - Overall assessment

### Tech Stack

- **Frontend**: React 19, Next.js 16, TypeScript
- **Editor**: Monaco Editor (VS Code editor)
- **Styling**: Tailwind CSS, custom dark theme
- **Backend**: Node.js, IBM watsonx API
- **Validation**: Zod schemas
- **Animations**: Framer Motion

## 📁 Project Structure

```
ReplicaForge/
├── backend/
│   ├── agents/
│   │   ├── base-agent.ts           # Base agent class
│   │   ├── analyzer-agent.ts       # Code analysis agent
│   │   ├── fixer-agent.ts          # Bug fixing agent
│   │   ├── tester-agent.ts         # Test generation agent
│   │   └── reporter-agent.ts       # Report generation agent
│   ├── api/
│   │   └── analyze.ts              # Main API endpoint
│   └── utils/
│       ├── watsonx-client.ts       # IBM watsonx wrapper
│       └── schemas.ts              # Data validation schemas
├── app/
│   ├── api/
│   │   └── code-analyzer/
│   │       └── route.ts            # API route wrapper
│   ├── styles/
│   │   └── code-analyzer.css       # Custom dark theme
│   ├── components/
│   │   ├── monaco-editor.tsx       # Code editor component
│   │   ├── results-tabs.tsx        # Tab navigation
│   │   ├── code-diff.tsx           # Before/after comparison
│   │   ├── issues-list.tsx         # Issues display
│   │   ├── test-cases-list.tsx     # Test cases display
│   │   ├── analysis-report.tsx     # Report display
│   │   └── progress-indicator.tsx  # Progress tracking
│   ├── page.tsx                    # Main application page
│   └── globals.css                 # Global styles
├── .env.example                    # Environment variables template
├── package.json                    # Dependencies
└── SETUP.md                        # This file
```

## 🎯 Features

### Code Analysis
- **Bug Detection**: Identifies errors, null pointer exceptions, type issues
- **Complexity Analysis**: Measures cyclomatic complexity, nesting depth
- **Security Issues**: Detects security vulnerabilities
- **Code Quality**: Identifies style and best practice violations

### Automatic Fixes
- **Smart Repairs**: Fixes identified issues with minimal changes
- **Explanation**: Provides clear descriptions of fixes applied
- **Safety First**: Preserves original functionality

### Test Generation
- **Comprehensive Coverage**: Unit, integration, and edge-case tests
- **Framework Support**: Jest, Mocha, and more
- **Coverage Estimates**: Predicted test coverage percentage

### Reporting
- **Executive Summary**: High-level overview of analysis
- **Score Breakdown**: 5-category scoring system
- **Recommendations**: Actionable improvement suggestions
- **Metrics**: Detailed statistics

## 🎨 UI Features

### Dark Theme Premium UI
- Zinc-950 background
- Lime-400 accent colors
- Smooth animations
- Professional design

### Code Editor
- Monaco Editor integration
- TypeScript/JavaScript support
- Line numbers
- Syntax highlighting
- Error diagnostics

### Interactive Results
- Tabbed interface
- Visual diff comparison
- Progress tracking
- Responsive design

## 🔄 Data Flow

1. **User Input**: User types code in Monaco Editor
2. **Analysis Request**: Click "Run AI Analysis"
3. **Agent Orchestration**: Sequential agent execution
   - Analyzer: Analyze code and detect issues
   - Fixer: Fix identified issues
   - Tester: Generate test cases
   - Reporter: Create comprehensive report
4. **JSON Response**: Each agent returns structured data
5. **Frontend Display**: Render results in tabbed interface
6. **Comparison**: Show before/after code diff

## 📊 API Endpoints

### POST /api/code-analyzer
Analyzes code using the multi-agent system.

**Request Body:**
```json
{
  "code": "function add(a, b) { return a + b; }",
  "language": "typescript"
}
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "id": "analysis-123",
    "status": "completed",
    "language": "typescript",
    "issues": [...],
    "fixedCode": "function add(a: number, b: number): number { return a + b; }",
    "testCases": [...],
    "report": {...}
  }
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `WATSONX_API_KEY` | IBM watsonx API key | Yes | - |
| `WATSONX_URL` | IBM Cloud endpoint | No | `https://us-south.ml.cloud.ibm.com` |
| `WATSONX_PROJECT_ID` | Project ID for watsonx | Yes | - |
| `WATSONX_MODEL_ID` | Model to use | No | `ibm/granite-13b-chat-v2` |
| `PORT` | Server port | No | `3000` |

### Code Size Limits

- Maximum code size: 100KB
- This is enforced to prevent excessive API calls

## 🧪 Testing

The project includes sample code in the Monaco Editor that demonstrates common issues:

```typescript
// Sample code with bugs:
// 1. Array index out of bounds
// 2. Missing type annotations
// 3. Potential null pointer
// 4. Unsafe user data handling
```

Run the development server and click "Run AI Analysis" to see the system in action.

## 🐛 Troubleshooting

### IBM watsonx API Error

**Error**: "Failed to authenticate with IBM watsonx"

**Solution**:
1. Verify your API key is correct
2. Check that the project ID is valid
3. Ensure you have access to the watsonx.ai service
4. Generate a new API key if needed

### Analysis Timeout

**Error**: "The website took too long to respond"

**Solution**:
1. Reduce code size (keep under 100KB)
2. Simplify complex code
3. Check your internet connection
4. Verify IBM watsonx API status

### Missing Dependencies

**Error**: Module not found errors

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

## 🚀 Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production

Set these in your Vercel project settings:

```
WATSONX_API_KEY=your_production_key
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your_project_id
WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
```

## 📈 Performance

- **Response Time**: ~30-60 seconds for typical code
- **API Calls**: 4 watsonx API calls per analysis
- **Cost**: Based on IBM watsonx usage (free tier available)
- **Concurrency**: Single analysis at a time (can be enhanced)

## 🔒 Security

- Input validation on all API endpoints
- Code size limits to prevent abuse
- Environment variable storage
- No sensitive data sent to external services beyond API

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

MIT License - feel free to use this project for hackathons and learning.

## 🆘 Support

If you encounter issues:

1. Check this documentation
2. Review IBM watsonx API documentation
3. Check the browser console for errors
4. Open an issue on GitHub

## 🎓 Learning

This project demonstrates:
- Multi-agent AI architecture
- React server components
- Monaco Editor integration
- IBM watsonx API usage
- Zod schema validation
- Dark theme UI design
- Progress tracking and state management

---

**Built with ❤️ for hackathons and real-world use**

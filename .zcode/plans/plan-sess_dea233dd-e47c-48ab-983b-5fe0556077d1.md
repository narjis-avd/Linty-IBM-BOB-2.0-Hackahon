# Multi-Agent AI Code Analysis System Architecture

## System Overview
Building a complete, production-level multi-agent AI system that analyzes JS/TS code, detects bugs, fixes them, generates tests, and produces comprehensive reports.

## Architecture Design

### 1. Multi-Agent System (4 Agents)
- **Analyzer Agent**: Deep code analysis, bug detection, complexity metrics
- **Fixer Agent**: Automatic bug fixing with explanations
- **Tester Agent**: Test case generation (unit, integration, edge cases)
- **Reporter Agent**: Comprehensive analysis report generation

### 2. Backend Structure
```
backend/
├── routes/
│   ├── /api/analyze POST - Main entry point
│   └── /api/status GET - Query job status
├── agents/
│   ├── base-agent.ts - Base agent class
│   ├── analyzer-agent.ts - Code analysis
│   ├── fixer-agent.ts - Bug fixing
│   ├── tester-agent.ts - Test generation
│   └── reporter-agent.ts - Report generation
├── utils/
│   ├── watsonx-client.ts - IBM watsonx API wrapper
│   ├── schema-validator.ts - JSON schema validation
│   └── code-parser.ts - Parse JS/TS code
└── middleware/
    └── rate-limiter.ts - API rate limiting
```

### 3. Frontend Structure
```
frontend/
├── pages/
│   ├── index.tsx - Code input & analysis trigger
│   ├── results.tsx - Analysis results display
│   └── comparison.tsx - Before/after comparison
├── components/
│   ├── MonacoEditor.tsx - Code editor integration
│   ├── ResultsTabs.tsx - Issues, Fixed Code, Tests, Report tabs
│   ├── CodeDiff.tsx - Visual code comparison
│   └── ProgressBar.tsx - Progress indicator
└── styles/
    └── dark-theme.css - Premium dark theme
```

### 4. Data Flow
1. **User Input**: Submit JS/TS code via Monaco Editor
2. **Analysis Request**: POST to `/api/analyze`
3. **Agent Orchestration**: Sequential agent processing
4. **JSON Response**: Each agent returns structured JSON
5. **Frontend Display**: Tabbed interface with all results
6. **Comparison**: Before/after diff for fixed code

### 5. IBM watsonx Integration
- Use Code Assistant model (GRANITE model)
- Structured prompts for each agent
- JSON mode for guaranteed schema compliance
- Stream responses for better UX

### 6. Key Features
- Dark theme premium UI (zinc-900 based)
- Monaco Editor for code input
- Real-time progress tracking
- Tabbed results (Issues, Fixed Code, Tests, Report)
- Visual diff comparison
- Error tracking & warnings
- Code complexity metrics
- Security analysis

## Implementation Steps

### Phase 1: Backend Foundation
1. Set up IBM watsonx client with authentication
2. Create base agent class with JSON output
3. Implement Analyzer Agent (bug detection, complexity)
4. Implement Fixer Agent (automatic fixes)
5. Implement Tester Agent (test generation)
6. Implement Reporter Agent (report generation)
7. Create main API route with agent orchestration

### Phase 2: Frontend UI
1. Setup dark theme styling (zinc-950 bg, lime-400 accents)
2. Create Monaco Editor wrapper component
3. Build results tabs component
4. Create code comparison/diff viewer
5. Implement progress indicator
6. Build responsive layout

### Phase 3: Integration & Polish
1. Connect frontend to backend API
2. Add error handling & loading states
3. Optimize for demo performance
4. Add sample data for immediate testing
5. Document setup instructions

## Output Structure
```
ReplicaForge/
├── backend/
│   ├── agent-analyzer.ts
│   ├── agent-fixer.ts
│   ├── agent-tester.ts
│   ├── agent-reporter.ts
│   ├── watsonx-client.ts
│   └── api/analyze.ts
├── frontend/
│   ├── pages/index.tsx
│   ├── pages/results.tsx
│   ├── components/monaco-editor.tsx
│   ├── components/results-tabs.tsx
│   └── styles/dark-theme.css
├── .env.example
├── README.md (updated)
└── SETUP.md (integration guide)
```

This approach ensures a complete, working hackathon-ready system with clear separation of concerns, proper JSON schemas between agents, and a polished dark-themed UI.
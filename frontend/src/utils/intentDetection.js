const TOOL_DEFINITIONS = {
  code_editor: {
    id: 'code_editor',
    label: 'Code Editor',
    subtitle: 'Syntax-aware workspace',
    icon: 'code',
  },
  data_grid: {
    id: 'data_grid',
    label: 'Data Grid',
    subtitle: 'Structured rows and metrics',
    icon: 'table',
  },
  image_canvas: {
    id: 'image_canvas',
    label: 'Image Canvas',
    subtitle: 'Prompt-to-visual workflow',
    icon: 'image',
  },
  docs_viewer: {
    id: 'docs_viewer',
    label: 'Docs Viewer',
    subtitle: 'Readable document context',
    icon: 'file',
  },
  file_upload: {
    id: 'file_upload',
    label: 'File Upload',
    subtitle: 'Drop docs or datasets',
    icon: 'upload',
  },
  voice_tools: {
    id: 'voice_tools',
    label: 'Voice Tools',
    subtitle: 'Capture and playback',
    icon: 'voice',
  },
};

const INTENT_DEFINITIONS = [
  {
    id: 'coding',
    label: 'Coding',
    tools: ['code_editor', 'file_upload'],
    indicator: 'Code detected',
  },
  {
    id: 'data_analysis',
    label: 'Data Analysis',
    tools: ['data_grid', 'file_upload', 'docs_viewer'],
    indicator: 'Data analysis detected',
  },
  {
    id: 'image_generation',
    label: 'Image Generation',
    tools: ['image_canvas', 'docs_viewer'],
    indicator: 'Image request detected',
  },
  {
    id: 'writing',
    label: 'Writing',
    tools: ['docs_viewer'],
    indicator: 'Writing task detected',
  },
  {
    id: 'voice',
    label: 'Voice',
    tools: ['voice_tools'],
    indicator: 'Voice workflow detected',
  },
];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function unique(items) {
  return Array.from(new Set(items));
}

function extractUrls(text) {
  const regex = /(https?:\/\/[^\s)]+)/gi;
  return text.match(regex) || [];
}

function extractCodeSnippet(text) {
  const fenceMatch = text.match(/```[\s\S]*?```/);
  if (fenceMatch) {
    return fenceMatch[0].replace(/```/g, '').trim();
  }

  const inlineCode = text
    .split('\n')
    .filter((line) => /[{}();<>]|\b(function|const|let|class|import|def|return|SELECT|FROM|WHERE)\b/i.test(line))
    .slice(0, 12)
    .join('\n')
    .trim();

  return inlineCode;
}

function extractCsvRows(text, maxRows = 6) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const csvLines = lines.filter((line) => {
    const commaCount = line.split(',').length - 1;
    return commaCount >= 2;
  });

  if (csvLines.length < 2) {
    return [];
  }

  return csvLines.slice(0, maxRows).map((line) => line.split(',').map((cell) => cell.trim()));
}

function extractDocumentOutline(text) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const headings = lines
    .filter((line) => line.startsWith('#') || /^[A-Z][A-Za-z\s]{6,}$/.test(line))
    .slice(0, 6)
    .map((line) => line.replace(/^#+\s*/, ''));

  return headings;
}

function intentScore(prompt) {
  const text = String(prompt || '');

  const codingSignals = [
    /```/.test(text),
    /\b(function|class|import|npm|pip|bug|refactor|stack trace|typescript|javascript|python|sql|regex|api endpoint|compile|lint)\b/i.test(text),
    /[{}();<>]/.test(text),
  ].filter(Boolean).length;

  const dataSignals = [
    /\b(data|dataset|csv|table|rows|columns|trend|analyze|analysis|pivot|correlation|aggregate|kpi)\b/i.test(text),
    /\d{2,}/.test(text),
    extractCsvRows(text).length > 0,
  ].filter(Boolean).length;

  const imageSignals = [
    /\b(image|illustration|render|poster|logo|thumbnail|visual|style|generate art|concept art)\b/i.test(text),
    /\b(photoreal|cinematic|4k|isometric|watercolor|anime|minimalist|prompt)\b/i.test(text),
  ].filter(Boolean).length;

  const writingSignals = [
    /\b(write|rewrite|summarize|essay|blog|email|proposal|statement|draft|tone)\b/i.test(text),
    text.split(/\s+/).filter(Boolean).length > 35,
  ].filter(Boolean).length;

  const voiceSignals = [
    /\b(voice|audio|microphone|speak|listen|transcribe|tts|speech)\b/i.test(text),
    /\b(read aloud|voice note|narrate)\b/i.test(text),
  ].filter(Boolean).length;

  return {
    coding: clamp(codingSignals / 3),
    data_analysis: clamp(dataSignals / 3),
    image_generation: clamp(imageSignals / 2),
    writing: clamp(writingSignals / 2),
    voice: clamp(voiceSignals / 2),
  };
}

function buildSuggestions(primaryIntent, metadata) {
  const base = [
    'Ask for a structured output format',
    'Add constraints (tone, length, framework)',
    'Attach files for richer context',
  ];

  if (primaryIntent === 'coding') {
    return [
      'Paste the exact error and expected behavior',
      'Ask for step-by-step debugging plan',
      'Request patch-style diff output',
      ...base,
    ];
  }

  if (primaryIntent === 'data_analysis') {
    return [
      'Define target metric and timeframe',
      'Ask for anomalies and trend summary',
      `Detected ${metadata.numericTokens} numeric values`,
      ...base,
    ];
  }

  if (primaryIntent === 'image_generation') {
    return [
      'Specify art style, lighting, and camera angle',
      'Add color palette and composition constraints',
      'Request 3 prompt variations',
      ...base,
    ];
  }

  if (primaryIntent === 'voice') {
    return [
      'Choose transcription language',
      'Ask for summarized audio notes',
      'Enable response playback mode',
      ...base,
    ];
  }

  return [
    'Ask for summary + action plan',
    'Request alternative versions',
    'Use bullet points and decision matrix',
    ...base,
  ];
}

export function detectPromptContext(prompt) {
  const text = String(prompt || '');
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return {
      intents: [],
      activeTools: [],
      indicators: ['Waiting for your prompt...'],
      metadata: {
        wordCount: 0,
        characterCount: 0,
        numericTokens: 0,
        links: 0,
      },
      preview: {
        codeSnippet: '',
        csvRows: [],
        documentOutline: [],
        imagePrompt: '',
      },
      suggestions: [
        'Paste code, data, images, or ideas to auto-activate tools',
      ],
      primaryIntent: null,
    };
  }

  const scores = intentScore(trimmed);

  const intents = INTENT_DEFINITIONS
    .map((definition) => {
      const score = scores[definition.id] || 0;
      if (score < 0.34) {
        return null;
      }

      return {
        ...definition,
        score,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);

  const fallbackIntent = {
    id: 'writing',
    label: 'Writing',
    tools: ['docs_viewer'],
    indicator: 'General assistant mode',
    score: 0.45,
  };

  const finalizedIntents = intents.length > 0 ? intents : [fallbackIntent];

  const toolWeights = {};
  finalizedIntents.forEach((intent) => {
    intent.tools.forEach((toolId) => {
      toolWeights[toolId] = Math.max(toolWeights[toolId] || 0, intent.score);
    });
  });

  if (/\b(pdf|docx|csv|xlsx|attachment|file|upload|spreadsheet)\b/i.test(lower)) {
    toolWeights.file_upload = Math.max(toolWeights.file_upload || 0, 0.52);
  }

  const activeTools = Object.entries(toolWeights)
    .sort((left, right) => right[1] - left[1])
    .map(([toolId, confidence]) => ({
      ...TOOL_DEFINITIONS[toolId],
      confidence: clamp(confidence),
    }));

  const codeSnippet = extractCodeSnippet(trimmed);
  const csvRows = extractCsvRows(trimmed);
  const documentOutline = extractDocumentOutline(trimmed);
  const imagePrompt = /\b(image|illustration|poster|render|logo|thumbnail|style)\b/i.test(trimmed)
    ? trimmed.slice(0, 240)
    : '';

  const numericTokens = (trimmed.match(/\b\d+(?:\.\d+)?\b/g) || []).length;
  const links = extractUrls(trimmed);

  const indicators = unique(
    finalizedIntents
      .slice(0, 3)
      .map((intent) => {
        const primaryTool = intent.tools[0];
        const toolName = TOOL_DEFINITIONS[primaryTool]?.label || 'Tools';
        return `${intent.indicator} -> ${toolName} enabled`;
      })
  );

  const primaryIntent = finalizedIntents[0]?.id || null;

  return {
    intents: finalizedIntents,
    activeTools,
    indicators,
    metadata: {
      wordCount: trimmed.split(/\s+/).filter(Boolean).length,
      characterCount: trimmed.length,
      numericTokens,
      links: links.length,
    },
    preview: {
      codeSnippet,
      csvRows,
      documentOutline,
      imagePrompt,
    },
    suggestions: buildSuggestions(primaryIntent, {
      numericTokens,
    }),
    primaryIntent,
  };
}

export { TOOL_DEFINITIONS };

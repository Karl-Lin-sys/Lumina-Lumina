export interface BlockData {
  id: string;
  text: string;
}

export interface AISuggestion {
  blockId: string;
  originalSnippet: string;
  suggestion: string;
  reason: string;
}

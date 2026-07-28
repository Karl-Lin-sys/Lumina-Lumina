import React, { useRef, useState, useEffect } from 'react';
import { BlockData, AISuggestion } from '../types';
import { Wand2, X, Check, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface BlockProps {
  block: BlockData;
  index: number;
  totalBlocks: number;
  onChange: (id: string, text: string) => void;
  onAdd: (index: number) => void;
  onDelete: (id: string) => void;
  contextBefore: string;
  contextAfter: string;
  suggestion?: AISuggestion;
  onApplySuggestion: () => void;
  onDismissSuggestion: () => void;
}

export const Block: React.FC<BlockProps> = ({ 
  block, 
  index, 
  totalBlocks,
  onChange, 
  onAdd, 
  onDelete, 
  contextBefore,
  contextAfter,
  suggestion,
  onApplySuggestion,
  onDismissSuggestion
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const resizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    resizeTextarea();
  }, [block.text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAdd(index);
    } else if (e.key === 'Backspace' && block.text === '') {
      e.preventDefault();
      onDelete(block.id);
    }
  };

  const handleAiIterate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: aiPrompt,
          blockText: block.text,
          contextBefore,
          contextAfter
        })
      });
      const data = await res.json();
      if (data.text) {
        onChange(block.id, data.text);
        setShowAiMenu(false);
        setAiPrompt('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div 
      className="relative group flex"
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
    >
      {/* Side Action Menu */}
      <div className={cn(
        "absolute -left-12 top-0 bottom-0 flex flex-col justify-start py-1 opacity-0 transition-opacity",
        (isFocused || showAiMenu) && "opacity-100"
      )}>
        <button
          onClick={() => setShowAiMenu(!showAiMenu)}
          className={cn(
            "p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors",
            showAiMenu && "text-orange-600 bg-orange-50"
          )}
        >
          <Wand2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={block.text}
          onChange={(e) => {
            onChange(block.id, e.target.value);
            resizeTextarea();
          }}
          onKeyDown={handleKeyDown}
          placeholder={index === 0 && totalBlocks === 1 ? 'Start writing...' : "Press '/' for commands..."}
          className="w-full bg-transparent border-none outline-none resize-none overflow-hidden min-h-[1.5em] text-lg leading-relaxed placeholder:text-slate-300"
          rows={1}
        />

        {/* AI Action Popover */}
        <AnimatePresence>
          {showAiMenu && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 top-full mt-2 w-full z-20 bg-white rounded-xl shadow-xl border border-slate-100 p-2 flex items-center gap-2"
            >
               <input
                 autoFocus
                 type="text"
                 value={aiPrompt}
                 onChange={e => setAiPrompt(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleAiIterate()}
                 placeholder="e.g. Make this more formal, or expand on this idea..."
                 className="flex-1 bg-slate-50 border-none outline-none px-3 py-2 rounded-lg text-sm"
                 disabled={isGenerating}
               />
               <button
                 onClick={handleAiIterate}
                 disabled={isGenerating || !aiPrompt.trim()}
                 className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
               >
                 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rewrite'}
               </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Proactive Suggestion Indicator / Popover */}
        <AnimatePresence>
          {suggestion && !showAiMenu && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute -right-4 top-0 translate-x-full w-64 bg-orange-50 rounded-xl shadow-md border border-orange-100 p-3 z-10"
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold text-orange-800 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Suggestion
                </span>
                <button onClick={onDismissSuggestion} className="text-orange-400 hover:text-orange-700">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-orange-900/70 mb-2 italic">"{suggestion.reason}"</p>
              <div className="text-sm text-slate-700 bg-white rounded p-2 mb-2 line-clamp-3">
                {suggestion.suggestion}
              </div>
              <button 
                onClick={onApplySuggestion}
                className="w-full flex items-center justify-center gap-1 bg-orange-600 hover:bg-orange-700 text-white py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Check className="w-3 h-3" /> Apply Change
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
      </div>
      
      {/* Visual cue if there is a suggestion */}
      {suggestion && (
          <div className="absolute -left-2 top-2 w-1 h-4 bg-orange-400 rounded-full animate-pulse" />
      )}
    </div>
  );
}

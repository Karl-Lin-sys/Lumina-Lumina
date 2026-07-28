/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BlockData, AISuggestion } from './types';
import { Sparkles, Send, Wand2, Paperclip, X } from 'lucide-react';
import { Block } from './components/Block';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [blocks, setBlocks] = useState<BlockData[]>([{ id: uuidv4(), text: '' }]);
  const [title, setTitle] = useState('');
  
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const handleUpdateBlock = (id: string, text: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, text } : b));
  };

  const handleAddBlock = (index: number) => {
    const newBlock = { id: uuidv4(), text: '' };
    setBlocks(prev => {
      const newBlocks = [...prev];
      newBlocks.splice(index + 1, 0, newBlock);
      return newBlocks;
    });
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks(prev => {
      if (prev.length === 1) return [{ id: uuidv4(), text: '' }];
      return prev.filter(b => b.id !== id);
    });
  };

  const fetchSuggestions = async () => {
    setIsSuggesting(true);
    try {
      const currentBlocks = blocksRef.current.filter(b => b.text.trim().length > 10);
      if (currentBlocks.length === 0) return;
      
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: currentBlocks })
      });
      const data = await res.json();
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (e) {
      console.error("Failed to fetch suggestions", e);
    } finally {
      setIsSuggesting(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
       const textLength = blocksRef.current.reduce((acc, b) => acc + b.text.length, 0);
       if (textLength > 50) {
           fetchSuggestions();
       }
    }, 15000); 
    return () => clearTimeout(timer);
  }, [blocks]);

  const applySuggestion = (suggestion: AISuggestion) => {
    handleUpdateBlock(suggestion.blockId, suggestion.suggestion);
    setSuggestions(prev => prev.filter(s => s.blockId !== suggestion.blockId));
  };

  const dismissSuggestion = (blockId: string) => {
    setSuggestions(prev => prev.filter(s => s.blockId !== blockId));
  };

  const handleGlobalGenerate = async () => {
    if (!globalPrompt.trim() && attachments.length === 0) return;
    setIsGenerating(true);
    try {
      const docText = blocks.map(b => b.text).join('\n\n');
      
      const filePromises = attachments.map(file => {
        return new Promise<{ base64: string, type: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            if (typeof reader.result === 'string') {
               // Extract base64 part
               const base64 = reader.result.split(',')[1];
               resolve({ base64, type: file.type });
            }
          };
          reader.onerror = reject;
        });
      });
      const filesData = await Promise.all(filePromises);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: globalPrompt,
          content: docText,
          files: filesData
        })
      });
      const data = await res.json();
      if (data.text) {
        const newTextBlocks = data.text.split('\n\n').filter((t: string) => t.trim());
        const newBlocks = newTextBlocks.map((t: string) => ({ id: uuidv4(), text: t }));
        
        setBlocks(prev => {
          if (prev.length === 1 && prev[0].text.trim() === '') {
             return newBlocks;
          }
          return [...prev, ...newBlocks];
        });
        setGlobalPrompt('');
        setAttachments([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-800 font-sans selection:bg-orange-100 selection:text-orange-900">
      <header className="sticky top-0 z-10 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-orange-900/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100">
            <Sparkles className="w-4 h-4 text-orange-600" />
          </div>
          <span className="font-semibold tracking-tight text-slate-700">Lumina</span>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={fetchSuggestions}
                disabled={isSuggesting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50"
            >
                <Wand2 className="w-4 h-4" />
                {isSuggesting ? 'Analyzing...' : 'Review Docs'}
            </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-32">
        <input 
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Document"
          className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-slate-300 mb-8 tracking-tight"
        />

        <div className="space-y-4">
          {blocks.map((block, i) => (
            <Block 
              key={block.id}
              block={block}
              index={i}
              totalBlocks={blocks.length}
              onChange={handleUpdateBlock}
              onAdd={handleAddBlock}
              onDelete={handleDeleteBlock}
              contextBefore={blocks.slice(Math.max(0, i-2), i).map(b => b.text).join('\n')}
              contextAfter={blocks.slice(i+1, i+3).map(b => b.text).join('\n')}
              suggestion={suggestions.find(s => s.blockId === block.id)}
              onApplySuggestion={() => {
                const s = suggestions.find(s => s.blockId === block.id);
                if (s) applySuggestion(s);
              }}
              onDismissSuggestion={() => dismissSuggestion(block.id)}
            />
          ))}
        </div>

      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
        <div className="bg-white rounded-2xl shadow-xl shadow-orange-900/5 border border-orange-900/10 p-2 flex flex-col gap-2 relative">
           
           {/* Attachments List */}
           {attachments.length > 0 && (
             <div className="flex gap-2 px-2 pt-2 flex-wrap">
               {attachments.map((file, i) => (
                 <div key={i} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-xs font-medium text-slate-600">
                   <span className="truncate max-w-[100px]">{file.name}</span>
                   <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500">
                     <X className="w-3 h-3" />
                   </button>
                 </div>
               ))}
             </div>
           )}

           <div className="absolute -top-10 left-4 flex gap-2">
              <AnimatePresence>
                  {isGenerating && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-orange-50 text-orange-700 text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-2 border border-orange-100"
                      >
                          <Sparkles className="w-3 h-3 animate-pulse" />
                          Generating...
                      </motion.div>
                  )}
              </AnimatePresence>
           </div>
           
           <div className="flex items-center gap-2">
               <label className="cursor-pointer p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                  <Paperclip className="w-5 h-5" />
                  <input 
                    type="file" 
                    className="hidden" 
                    multiple
                    onChange={e => {
                      if (e.target.files) {
                         setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                      }
                      e.target.value = ''; // Reset input
                    }} 
                  />
               </label>

               <div className="flex-1 flex items-center px-3 bg-slate-50/50 rounded-xl focus-within:bg-slate-50 transition-colors">
                  <Sparkles className="w-4 h-4 text-orange-400 mr-2 shrink-0" />
                  <input 
                    type="text" 
                    value={globalPrompt}
                    onChange={e => setGlobalPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGlobalGenerate()}
                    placeholder="Ask AI to write or continue..."
                    className="w-full bg-transparent border-none outline-none py-3 text-sm placeholder:text-slate-400"
                    disabled={isGenerating}
                  />
               </div>
               
               <button 
                 onClick={handleGlobalGenerate}
                 disabled={isGenerating || (!globalPrompt.trim() && attachments.length === 0)}
                 className="w-10 h-10 flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition-colors disabled:opacity-50 shrink-0"
               >
                 <Send className="w-4 h-4" />
               </button>
           </div>
        </div>
      </div>
    </div>
  );
}

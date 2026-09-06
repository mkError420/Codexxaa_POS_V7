import React, { useState } from 'react';

export default function VoiceAssistantHUD({
  isListening,
  transcript,
  feedback,
  status, // 'idle' | 'listening' | 'processing' | 'success' | 'error'
  isContinuous,
  onToggleContinuous,
  isMuted,
  onToggleMute,
  onStop,
  onStart,
  showHelp,
  onToggleHelp
}) {
  if (!isListening && !showHelp && !feedback) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes soundWave {
          0%, 100% { height: 6px; }
          50% { height: 24px; }
        }
        .voice-bar-1 { animation: soundWave 0.8s ease-in-out infinite 0.1s; }
        .voice-bar-2 { animation: soundWave 0.8s ease-in-out infinite 0.3s; }
        .voice-bar-3 { animation: soundWave 0.8s ease-in-out infinite 0.15s; }
        .voice-bar-4 { animation: soundWave 0.8s ease-in-out infinite 0.4s; }
        .voice-bar-5 { animation: soundWave 0.8s ease-in-out infinite 0.25s; }
      `}</style>

      {/* Floating Active Voice Bar */}
      {(isListening || feedback) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-xl transition-all duration-300 animate-fadeIn">
          <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 p-4 flex flex-col gap-2.5">
            
            {/* Top row: Status, Audio Waveform & Controls */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Visualizer or Status Icon */}
                {isListening ? (
                  <div className="flex items-center gap-1 h-6 px-1">
                    <span className="w-1 bg-red-500 rounded-full voice-bar-1"></span>
                    <span className="w-1 bg-rose-400 rounded-full voice-bar-2"></span>
                    <span className="w-1 bg-amber-400 rounded-full voice-bar-3"></span>
                    <span className="w-1 bg-sky-400 rounded-full voice-bar-4"></span>
                    <span className="w-1 bg-emerald-400 rounded-full voice-bar-5"></span>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 text-sky-400">
                      {isListening ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                          Listening...
                        </>
                      ) : (
                        'Voice Assistant'
                      )}
                    </span>
                    {isContinuous && (
                      <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-semibold">
                        Hands-Free
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isListening
                      ? 'Say e.g., "Add 2 Coca Cola" or "Search Apple"'
                      : 'Voice recognition stopped'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                {/* Continuous Hands-Free Toggle */}
                <button
                  type="button"
                  onClick={onToggleContinuous}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isContinuous
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                  title={isContinuous ? 'Hands-Free Mode Enabled (keeps listening)' : 'Enable Hands-Free Mode'}
                >
                  Hands-Free
                </button>

                {/* Voice Feedback Mute Toggle */}
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`p-1.5 rounded-lg text-xs transition-colors ${
                    isMuted
                      ? 'bg-slate-800 text-slate-500 hover:text-slate-300'
                      : 'bg-slate-800 text-sky-400 hover:bg-slate-700'
                  }`}
                  title={isMuted ? 'Unmute Assistant Voice' : 'Mute Assistant Voice'}
                >
                  {isMuted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>

                {/* Commands Help */}
                <button
                  type="button"
                  onClick={onToggleHelp}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Voice Commands Guide"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {/* Close/Stop Button */}
                <button
                  type="button"
                  onClick={isListening ? onStop : onStart}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isListening
                      ? 'bg-red-600/90 hover:bg-red-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isListening ? 'Stop' : 'Start'}
                </button>
              </div>
            </div>

            {/* Middle row: Live Transcript / Spoken Text */}
            {transcript && (
              <div className="bg-slate-800/80 rounded-xl px-3 py-2 border border-slate-700/60 flex items-center gap-2 text-sm">
                <span className="text-slate-400 text-xs flex-shrink-0">Heard:</span>
                <span className="font-semibold text-white truncate">"{transcript}"</span>
              </div>
            )}

            {/* Bottom row: Feedback Banner */}
            {feedback && (
              <div
                className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
                  status === 'error'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                    : status === 'success'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                    : 'bg-sky-950/80 text-sky-300 border border-sky-800/60'
                }`}
              >
                {status === 'error' && (
                  <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {status === 'success' && (
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {status === 'processing' && (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin flex-shrink-0"></div>
                )}
                <span className="flex-1">{feedback}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Voice Commands Guide Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={onToggleHelp}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">POS Voice Commands Guide</h3>
                  <p className="text-xs text-slate-500">Fast hands-free checkout with your voice</p>
                </div>
              </div>
              <button
                onClick={onToggleHelp}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1 text-sm">
              
              {/* Add to Cart */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-950 text-xs mb-1 uppercase tracking-wide">
                  <span>🛒 Add to Cart with Quantity</span>
                </div>
                <div className="space-y-1 text-xs text-indigo-900">
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Add 2 Coca Cola"</code></p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Add 3 bottles of milk to cart"</code></p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Put 5 apples in cart"</code></p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Add Lay's chips"</code> (defaults to qty 1)</p>
                </div>
              </div>

              {/* Search Product */}
              <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100">
                <div className="flex items-center gap-1.5 font-semibold text-sky-950 text-xs mb-1 uppercase tracking-wide">
                  <span>🔍 Search / Filter Products</span>
                </div>
                <div className="space-y-1 text-xs text-sky-900">
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Search iPhone"</code></p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Find coffee"</code></p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Sprite"</code> (searches for Sprite instantly)</p>
                </div>
              </div>

              {/* Cart Operations */}
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                <div className="flex items-center gap-1.5 font-semibold text-rose-950 text-xs mb-1 uppercase tracking-wide">
                  <span>🗑️ Cart Management</span>
                </div>
                <div className="space-y-1 text-xs text-rose-900">
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Remove milk"</code> (removes milk from cart)</p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Clear cart"</code> (empties current sale tab)</p>
                </div>
              </div>

              {/* Checkout & Bill Hold */}
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-950 text-xs mb-1 uppercase tracking-wide">
                  <span>💳 Billing & Hold Bill</span>
                </div>
                <div className="space-y-1 text-xs text-emerald-900">
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Checkout"</code> or <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Pay"</code> (opens payment preview)</p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Hold bill"</code> (holds current bill)</p>
                </div>
              </div>

              {/* Spelling Recognition */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80">
                <div className="flex items-center gap-1.5 font-semibold text-amber-950 text-xs mb-1 uppercase tracking-wide">
                  <span>🔤 Spell Letter-by-Letter (Spelling Support)</span>
                </div>
                <div className="space-y-1 text-xs text-amber-900">
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"C O K E"</code> (collapses letters to search Coke)</p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Spell M I L K"</code> or <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Spelling Pepsi"</code></p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Add 2 C O K E"</code> (adds 2 Coke directly)</p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"P E P S I"</code> or <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"S P R I T E"</code></p>
                </div>
              </div>

              {/* South Asian / Bengali Support */}
              <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200/80">
                <div className="flex items-center gap-1.5 font-semibold text-teal-950 text-xs mb-1 uppercase tracking-wide">
                  <span>🌏 South Asian & Bengali Accent Friendly</span>
                </div>
                <div className="space-y-1 text-xs text-teal-900">
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Coke 2 ta dao"</code> or <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Duita pepsi den"</code></p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Sprite add koro"</code> or <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Coke cart-e dao"</code></p>
                  <p>• <code className="bg-white px-1.5 py-0.5 rounded border font-semibold">"Milk bad dao"</code> (removes item from cart)</p>
                  <p>• Works with native terms: <span className="font-medium">deem, murgi, dal, aloo, cha, dudh, biskut, tel, pani</span></p>
                </div>
              </div>

              {/* Pro Tips */}
              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 flex items-start gap-2">
                <span className="text-base">💡</span>
                <div>
                  <strong>Pro Tip:</strong> Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-800 font-semibold shadow-xs">Alt</kbd> + <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-800 font-semibold shadow-xs">V</kbd> on your keyboard anytime to start or stop voice input without touching your mouse!
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={onToggleHelp}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Got It, Let's Try!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useState } from "react";
import { HelpCircle, CheckCircle, XCircle, RotateCcw, ArrowRight } from "lucide-react";

const QUIZ_QUESTIONS = [
  {
    question: "Which HTTP response header is specifically designed to mitigate Clickjacking attacks?",
    options: [
      "Strict-Transport-Security",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Content-Type"
    ],
    answerIndex: 1,
    explanation: "X-Frame-Options allows web server administrators to declare whether the page can be loaded inside an <iframe>, protecting users from UI redressing/clickjacking."
  },
  {
    question: "What is the most effective programming practice to completely prevent SQL Injection?",
    options: [
      "Replacing single quotes with double quotes",
      "Using Prepared Statements / Parameterized Queries",
      "Limiting the text length of query forms",
      "Using base64 encoding on all input elements"
    ],
    answerIndex: 1,
    explanation: "Parameterized queries separate the query structure from the user data, ensuring the SQL interpreter treats all inputs strictly as variables rather than executable commands."
  },
  {
    question: "Which cookie attribute prevents client-side Javascript code (like document.cookie) from accessing session tokens?",
    options: [
      "Secure",
      "SameSite=Strict",
      "HttpOnly",
      "Path"
    ],
    answerIndex: 2,
    explanation: "The HttpOnly flag informs the browser that the cookie should not be exposed to client-side scripts, protecting it from theft during Cross-Site Scripting (XSS) attacks."
  },
  {
    question: "In cybersecurity, what does a CSRF (Cross-Site Request Forgery) attack force an active victim to do?",
    options: [
      "Download a trojan backdoor onto their computer",
      "Trigger unintended state-changing requests while authenticated",
      "Encrypt their user database files with ransomware",
      "Allow hackers to eavesdrop on their local Wi-Fi router"
    ],
    answerIndex: 1,
    explanation: "CSRF exploits the trust a site has in the victim's browser, transmitting unauthorized actions (like changing passwords or emails) automatically using the active session cookies."
  },
  {
    question: "Which hash algorithm is highly recommended for securely hashing passwords in databases?",
    options: [
      "MD5 (Message Digest 5)",
      "Bcrypt or Argon2",
      "SHA-1 (Secure Hash Algorithm 1)",
      "AES (Advanced Encryption Standard)"
    ],
    answerIndex: 1,
    explanation: "Bcrypt and Argon2 are slow hashing algorithms designed with adjustable work factor costs to successfully counter high-performance brute force dictionary attacks. (AES is encryption, not hashing)."
  }
];

export default function SecurityQuiz() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const activeQ = QUIZ_QUESTIONS[currentIdx];

  const handleOptionClick = (optIdx) => {
    if (selectedOpt !== null) return; // Prevent double selections
    setSelectedOpt(optIdx);
    setShowExplanation(true);
    if (optIdx === activeQ.answerIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    setSelectedOpt(null);
    setShowExplanation(false);
    if (currentIdx + 1 < QUIZ_QUESTIONS.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setSelectedOpt(null);
    setShowExplanation(false);
    setScore(0);
    setQuizFinished(false);
  };

  return (
    <div className="bg-cyber-card border border-cyber-border rounded-xl p-5 font-mono text-white flex flex-col h-full cyber-glow">
      <div className="flex items-center justify-between border-b border-cyber-border pb-3 mb-4">
        <h2 className="text-sm font-bold text-cyber-primary flex items-center space-x-2">
          <HelpCircle className="h-4.5 w-4.5" />
          <span>Aegis Security Trivia Quiz</span>
        </h2>
        <span className="text-xs text-gray-400">
          Score: {score}/{QUIZ_QUESTIONS.length}
        </span>
      </div>

      {!quizFinished ? (
        <div className="flex-grow flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            {/* Question Text */}
            <p className="text-xs leading-relaxed text-gray-200 font-semibold bg-slate-900/50 p-3.5 border border-cyber-border/40 rounded-lg">
              Q{currentIdx + 1}: {activeQ.question}
            </p>

            {/* Options List */}
            <div className="flex flex-col gap-2.5">
              {activeQ.options.map((opt, oIdx) => {
                let btnStyle = "bg-slate-900 border-cyber-border hover:border-cyber-primary text-gray-300";
                let icon = null;

                if (selectedOpt !== null) {
                  if (oIdx === activeQ.answerIndex) {
                    btnStyle = "bg-emerald-950/40 border-emerald-500 text-emerald-300";
                    icon = <CheckCircle className="h-3.5 w-3.5 shrink-0" />;
                  } else if (oIdx === selectedOpt) {
                    btnStyle = "bg-rose-950/40 border-rose-500 text-rose-300";
                    icon = <XCircle className="h-3.5 w-3.5 shrink-0" />;
                  } else {
                    btnStyle = "bg-slate-900/40 border-cyber-border/20 text-gray-500 opacity-60";
                  }
                }

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleOptionClick(oIdx)}
                    disabled={selectedOpt !== null}
                    className={`w-full px-4 py-2.5 rounded-lg border text-left text-[11px] transition-all flex items-center justify-between gap-3 ${
                      selectedOpt === null ? "cursor-pointer" : "cursor-default"
                    } ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {icon}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Explanation and Next controls */}
          <div className="space-y-4 pt-2">
            {showExplanation && (
              <div className="bg-cyan-950/20 border border-cyan-800/40 p-3 rounded-lg text-[10px] text-gray-300 leading-relaxed">
                <span className="font-bold text-cyber-primary text-[11px] block mb-1">REMEDIATION INSIGHT:</span>
                {activeQ.explanation}
              </div>
            )}

            {selectedOpt !== null && (
              <button
                onClick={handleNext}
                className="w-full py-2 bg-cyber-primary hover:bg-cyan-400 text-black font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-[0_0_8px_rgba(0,240,255,0.15)]"
              >
                <span>{currentIdx + 1 === QUIZ_QUESTIONS.length ? "Finish Quiz" : "Next Question"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center text-center py-6 space-y-5">
          <div className="p-3 bg-cyber-primary/10 border border-cyber-primary/20 rounded-full">
            <HelpCircle className="h-10 w-10 text-cyber-primary animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Quiz Completed!</h3>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed max-w-xs">
              You scored <span className="text-cyber-primary font-bold">{score}/{QUIZ_QUESTIONS.length}</span> correct answers. Hardening server configs makes you a safer operator!
            </p>
          </div>
          <button
            onClick={handleReset}
            className="px-5 py-2 bg-slate-900 border border-cyber-border hover:border-cyber-primary text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </div>
  );
}

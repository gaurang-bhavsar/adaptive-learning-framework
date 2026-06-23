import React, { useState } from 'react';
import { X, Award, CheckCircle2, AlertCircle, RefreshCw, BarChart2 } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function TestModal() {
  const { testModalOpen, activeTest, selectedNodeId, submitTestAnswers, setTestModalOpen, roadmap } = useStore();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const stepNode = roadmap?.nodes.find(n => n.id === selectedNodeId);

  if (!testModalOpen || !activeTest || !stepNode) return null;

  const handleOptionChange = (qId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
    if (confidences[qId] === undefined) {
      setConfidences(prev => ({ ...prev, [qId]: 70 })); // default confidence
    }
  };

  const handleConfidenceChange = (qId: string, val: number) => {
    setConfidences(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const answersPayload = activeTest.questions.map(q => ({
      question_id: q.id,
      answer: answers[q.id] || '',
      confidence: confidences[q.id] || 50
    }));

    try {
      const res = await submitTestAnswers(stepNode.id, answersPayload);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAnswers({});
    setConfidences({});
    setResult(null);
    setTestModalOpen(false);
  };

  const getCalibrationColor = (label: string) => {
    switch (label) {
      case 'Well-calibrated': return 'text-green-600 bg-green-50 border-green-200';
      case 'Overconfident': return 'text-red-600 bg-red-50 border-red-200';
      case 'Underconfident': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getClassBadge = (cls: string) => {
    switch (cls) {
      case 'Mastered': return 'bg-green-100 text-green-800';
      case 'Uncertain': return 'bg-blue-100 text-blue-800';
      case 'Misconception': return 'bg-red-100 text-red-800';
      default: return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-[#16161A]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#E7E7EA] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600">
              Adaptive step assessment
            </span>
            <h3 className="text-base font-semibold text-gray-800">{stepNode.title}</h3>
          </div>
          {!loading && (
            <button
              onClick={handleClose}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-gray-500">Scoring answers and running calibration check...</p>
            </div>
          ) : result ? (
            /* Results Panel */
            <div className="space-y-6">
              <div className="text-center p-6 bg-gray-50 rounded-xl border border-[#E7E7EA] space-y-3">
                <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-full">
                  <Award className="w-8 h-8 text-indigo-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-800">Test Score: {result.score}%</h4>
                
                {/* Calibration Banner */}
                <div className={`inline-flex flex-col items-center gap-1 px-4 py-2 rounded-lg border text-sm font-medium ${getCalibrationColor(result.calibration)}`}>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <BarChart2 className="w-4 h-4" />
                    <span>Calibration: {result.calibration}</span>
                  </div>
                  <span className="text-[11px] opacity-80">
                    Upfront Confidence Prediction: {result.classifications[0] ? result.self_reported_confidence : 0}% vs. Measured Correctness: {result.score}%
                  </span>
                </div>
              </div>

              {/* Question breakdowns */}
              <div className="space-y-4">
                <h5 className="font-semibold text-gray-800 text-[13px] border-b border-gray-100 pb-1">
                  Answers Breakdown
                </h5>
                {activeTest.questions.map((q, idx) => {
                  const clsInfo = result.classifications.find((c: any) => c.question_id === q.id);
                  const isCorrect = clsInfo?.correct ?? false;
                  
                  return (
                    <div key={q.id} className="p-4 bg-white border border-[#E7E7EA] rounded-xl space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          {isCorrect ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-semibold text-[13.5px] text-gray-800">
                              Question {idx + 1}: {q.prompt}
                            </p>
                          </div>
                        </div>
                        {clsInfo && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getClassBadge(clsInfo.classification)}`}>
                            {clsInfo.classification}
                          </span>
                        )}
                      </div>
                      <div className="pl-7 text-[12.5px] space-y-1 text-gray-600">
                        <p>
                          <span className="font-medium text-gray-500">Your Answer:</span>{' '}
                          <span className="font-semibold">{answers[q.id] || 'Not answered'}</span>
                        </p>
                        <p>
                          <span className="font-medium text-gray-500">Correct Answer:</span>{' '}
                          <span className="font-semibold text-green-700">{q.correct_answer}</span>
                        </p>
                        <p className="text-gray-500 mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-[12px] italic">
                          <span className="font-bold not-italic block text-gray-600 mb-0.5">Explanation:</span>
                          {q.explanation}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Test Quiz Form */
            <div className="space-y-6">
              {activeTest.questions.map((q, idx) => (
                <div key={q.id} className="p-4 bg-gray-50 border border-[#E7E7EA] rounded-xl space-y-3">
                  <div className="font-semibold text-gray-800 text-[14px]">
                    Q{idx + 1}: {q.prompt}
                  </div>
                  
                  {/* Options */}
                  {q.type === 'mcq' && q.options && q.options.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {q.options.map((opt, oIdx) => (
                        <label
                          key={oIdx}
                          className={`flex items-center gap-2.5 p-3 rounded-lg border bg-white cursor-pointer hover:bg-indigo-50/20 hover:border-indigo-200 transition-all ${answers[q.id] === opt ? 'border-indigo-600 bg-indigo-50/10' : 'border-gray-200'}`}
                        >
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={() => handleOptionChange(q.id, opt)}
                            className="text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                          />
                          <span className="text-[13px] text-gray-700 font-medium">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={answers[q.id] || ''}
                      onChange={(e) => handleOptionChange(q.id, e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full bg-white border border-gray-250 rounded-lg p-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                  )}

                  {/* Confidence Slider per Question */}
                  {q.confidence_prompt && (
                    <div className="pt-2 border-t border-gray-200/50 flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[11px] font-semibold text-gray-500">
                        <span>How certain are you?</span>
                        <span className="text-indigo-600 font-bold">{confidences[q.id] ?? 70}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={confidences[q.id] ?? 70}
                        onChange={(e) => handleConfidenceChange(q.id, parseInt(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E7E7EA] flex justify-end gap-2 bg-gray-50 rounded-b-xl">
          {result ? (
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer"
            >
              Back to Roadmap
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || activeTest.questions.some(q => !answers[q.id])}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer"
            >
              Submit Answers
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

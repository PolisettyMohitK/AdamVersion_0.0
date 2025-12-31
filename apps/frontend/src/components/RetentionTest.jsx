import React, { useState, useEffect } from "react";
import { useSpeech } from "../hooks/useSpeech";
import BACKEND_URL from "../config/api";

export const RetentionTest = ({ chatHistory, onClose }) => {
  const { tts, stopAudio } = useSpeech();
  const [test, setTest] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Generate retention test based on chat history
  const generateTest = async () => {
    if (!chatHistory || chatHistory.length === 0) {
      setError("No conversation history available for testing");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${BACKEND_URL}/retention-test/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatHistory }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate test: ${response.statusText}`);
      }

      const testData = await response.json();
      setTest(testData);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setShowResults(false);
      setFeedback("");
    } catch (err) {
      console.error("Error generating test:", err);
      setError("Failed to generate test. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle answer selection
  const handleAnswerSelect = (questionId, optionId) => {
    if (showResults) return; // Don't allow changes after submitting

    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  // Submit test and get results
  const submitTest = async () => {
    if (!test) return;

    // Check if all questions have been answered
    const allAnswered = test.questions.every(q => selectedAnswers[q.id]);
    if (!allAnswered) {
      setError("Please answer all questions before submitting");
      return;
    }

    setShowResults(true);

    // Prepare test results for feedback
    const testResults = {
      testTitle: test.testTitle,
      questions: test.questions.map(q => ({
        id: q.id,
        question: q.question,
        selectedAnswer: selectedAnswers[q.id],
        correctAnswer: q.correctAnswer,
        isCorrect: selectedAnswers[q.id] === q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic
      })),
      score: calculateScore()
    };

    // Generate personalized feedback
    await generateFeedback(testResults);
  };

  // Calculate test score
  const calculateScore = () => {
    if (!test) return 0;

    const correctCount = test.questions.filter(q =>
      selectedAnswers[q.id] === q.correctAnswer
    ).length;

    return Math.round((correctCount / test.questions.length) * 100);
  };

  // Generate personalized feedback
  const generateFeedback = async (testResults) => {
    setIsGeneratingFeedback(true);
    setError("");

    try {
      const response = await fetch(`${BACKEND_URL}/retention-test/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ testResults, chatHistory }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate feedback: ${response.statusText}`);
      }

      const feedbackData = await response.json();
      setFeedback(feedbackData.feedback);

      // Speak the feedback through the avatar
      tts(feedbackData.feedback);
    } catch (err) {
      console.error("Error generating feedback:", err);
      setError("Failed to generate feedback. Please try again.");
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  // Reset test to start over
  const resetTest = () => {
    setTest(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
    setFeedback("");
    setError("");
    stopAudio();
  };

  // Initialize test on component mount
  useEffect(() => {
    generateTest();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <h3 className="text-xl font-medium text-white mb-2">Generating Your Retention Test</h3>
            <p className="text-gray-300">Creating personalized questions based on your conversation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Retention Test</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center text-red-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-2 text-red-100">{error}</p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!test) {
    return null;
  }

  const currentQuestion = test.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === test.questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{test.testTitle}</h2>
            <p className="text-gray-400">Test your knowledge based on our conversation</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {feedback ? (
          /* Feedback View */
          <div className="space-y-6">
            <div className="bg-purple-900 bg-opacity-30 border border-purple-700 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-bold text-white">Your Test Results</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-purple-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">{calculateScore()}%</div>
                  <div className="text-purple-200">Overall Score</div>
                </div>
                <div className="bg-blue-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">
                    {test.questions.filter(q => selectedAnswers[q.id] === q.correctAnswer).length}
                  </div>
                  <div className="text-blue-200">Correct Answers</div>
                </div>
                <div className="bg-amber-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">
                    {test.questions.filter(q => selectedAnswers[q.id] !== q.correctAnswer).length}
                  </div>
                  <div className="text-amber-200">Incorrect Answers</div>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-lg font-semibold text-white mb-3">Personalized Feedback</h4>
                <div className="prose prose-invert max-w-none">
                  <p className="text-gray-200 whitespace-pre-wrap">{feedback}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={resetTest}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retake Test
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : showResults ? (
          /* Results Review View */
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white">Review Your Answers</h3>

            <div className="space-y-4">
              {test.questions.map((question, index) => {
                const selectedAnswer = selectedAnswers[question.id];
                const isCorrect = selectedAnswer === question.correctAnswer;

                return (
                  <div
                    key={question.id}
                    className={`border rounded-lg p-4 ${isCorrect ? 'border-green-500 bg-green-900 bg-opacity-20' : 'border-red-500 bg-red-900 bg-opacity-20'
                      }`}
                  >
                    <div className="flex items-start mb-3">
                      <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center mr-3 ${isCorrect ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                        <span className="text-white text-sm font-bold">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{question.question}</h4>
                        <div className="mt-2 text-sm">
                          <span className="text-gray-400">Topic: </span>
                          <span className="text-gray-200">{question.topic}</span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-9 space-y-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-400 mr-2">Your answer:</span>
                        <span className={`font-medium ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                          {selectedAnswer || 'Not answered'}
                        </span>
                      </div>

                      {!isCorrect && (
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-400 mr-2">Correct answer:</span>
                          <span className="font-medium text-green-400">
                            {question.correctAnswer}
                          </span>
                        </div>
                      )}

                      <div className="mt-3 p-3 bg-gray-700 rounded-lg">
                        <p className="text-gray-200 text-sm whitespace-pre-wrap">{question.explanation}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                onClick={submitTest}
                disabled={isGeneratingFeedback}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center disabled:opacity-50"
              >
                {isGeneratingFeedback ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Feedback...
                  </>
                ) : (
                  'Get Personalized Feedback'
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Test Taking View */
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full"
                style={{ width: `${((currentQuestionIndex + 1) / test.questions.length) * 100}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-sm text-gray-400">
              <span>Question {currentQuestionIndex + 1} of {test.questions.length}</span>
              <span>{test.questions[currentQuestionIndex].topic}</span>
            </div>

            {/* Question */}
            <div className="bg-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-medium text-white mb-6">{currentQuestion.question}</h3>

              <div className="space-y-3">
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedAnswers[currentQuestion.id] === option.id;

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                      className={`w-full text-left p-4 rounded-lg transition-colors ${isSelected
                          ? 'bg-indigo-600 border-indigo-500'
                          : 'bg-gray-600 hover:bg-gray-500 border-gray-500'
                        } border`}
                    >
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-6 w-6 rounded-full border flex items-center justify-center mr-4 ${isSelected ? 'border-indigo-300' : 'border-gray-400'
                          }`}>
                          {isSelected && (
                            <div className="h-3 w-3 rounded-full bg-indigo-300"></div>
                          )}
                        </div>
                        <span className="text-white">{option.text}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={isFirstQuestion}
                className={`px-6 py-3 rounded-lg transition-colors flex items-center ${isFirstQuestion
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-500'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              {isLastQuestion ? (
                <button
                  onClick={submitTest}
                  disabled={!selectedAnswers[currentQuestion.id]}
                  className={`px-6 py-3 rounded-lg transition-colors flex items-center ${selectedAnswers[currentQuestion.id]
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  Submit Test
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(test.questions.length - 1, prev + 1))}
                  disabled={!selectedAnswers[currentQuestion.id]}
                  className={`px-6 py-3 rounded-lg transition-colors flex items-center ${selectedAnswers[currentQuestion.id]
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  Next
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
import { useState, useCallback } from 'react';

/**
 * useAIQuery (Framework Example Version)
 *
 * This hook is an intentionally simplified example that demonstrates:
 * - State shape for AI responses
 * - How a component can trigger async AI work
 * - Where to plug in your own ToolExecutor / backend orchestration
 *
 * The full production orchestration logic lives in the private application
 * and should NOT be published. Treat this as a teaching stub only.
 */

export const useAIQuery = (map, updateToolFeedback, handleMarkerClick = null) => {
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState([]);

  // Helper to append a new response
  const appendResponse = useCallback((content) => {
    const id = `query_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setResponses(prev => [
      ...prev,
      {
        id,
        content,
        isLoading: false,
        metadata: null,
      },
    ]);
  }, []);

  /**
   * Example AI query handler
   *
   * In your real app, this is where you:
   * - Build prompts
   * - Call your backend / AI provider
   * - Orchestrate tools via your ToolExecutor
   *
   * Here we just simulate a response for demonstration.
   */
  const handleAIQuery = useCallback(async (questionData) => {
    setIsLoading(true);

    if (updateToolFeedback) {
      updateToolFeedback({
        isActive: true,
        tool: 'ai',
        status: 'Running example AI query...',
        progress: 30,
        details: questionData?.query || 'Example query',
      });
    }

    try {
      // Simulate latency
      await new Promise(resolve => setTimeout(resolve, 600));

      const content =
        `Example AI response for: **${questionData?.query || 'example question'}**\n\n` +
        `This framework hook is a *stub* that shows how to:\n` +
        `- Manage loading state\n` +
        `- Append AI responses into a list\n` +
        `- Integrate with your own ToolExecutor and orchestration logic.`;

      appendResponse(content);
    } finally {
      setIsLoading(false);
      if (updateToolFeedback) {
        updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 100,
          details: '',
        });
      }
    }
  }, [appendResponse, updateToolFeedback]);

  return {
    isLoading,
    responses,
    handleAIQuery,
  };
};

export default useAIQuery;



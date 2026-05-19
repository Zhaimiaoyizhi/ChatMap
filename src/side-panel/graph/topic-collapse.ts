type TopicSourceNode = {
  id: string;
  title: string;
  summary: string;
  position: { x: number; y: number };
  turnIndex?: number;
};

type BuildCollapsedTopicInput = {
  selectedNodes: TopicSourceNode[];
  now?: number;
};

export type CollapsedTopic = {
  id: string;
  title: string;
  summary: string;
  position: { x: number; y: number };
  hiddenNodeIds: string[];
  tags: string[];
};

function compactText(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}...` : clean;
}

export function buildCollapsedTopic(input: BuildCollapsedTopicInput): CollapsedTopic {
  const selectedNodes = [...input.selectedNodes].sort(
    (left, right) => (left.turnIndex ?? 0) - (right.turnIndex ?? 0)
  );
  if (selectedNodes.length < 2) {
    throw new Error("At least two nodes are required to collapse a topic.");
  }

  const now = input.now ?? Date.now();
  const firstNode = selectedNodes[0];
  const averagePosition = selectedNodes.reduce(
    (position, node) => ({
      x: position.x + node.position.x / selectedNodes.length,
      y: position.y + node.position.y / selectedNodes.length
    }),
    { x: 0, y: 0 }
  );

  return {
    id: `custom-topic-${now}-${firstNode.id}`,
    title: compactText(`Topic: ${firstNode.title}`, 120),
    summary: [
      `Collapsed topic from ${selectedNodes.length} turns.`,
      "",
      ...selectedNodes.map((node) => {
        const label = typeof node.turnIndex === "number" ? `Turn ${node.turnIndex + 1}` : "Note";
        return `- ${label}: ${compactText(node.title, 80)}\n  ${compactText(node.summary, 180)}`;
      })
    ].join("\n"),
    position: {
      x: Math.round(averagePosition.x),
      y: Math.round(averagePosition.y)
    },
    hiddenNodeIds: selectedNodes.map((node) => node.id),
    tags: ["topic"]
  };
}


"use client";

import { ActivityGroup } from "@/components/chat/ActivityGroup";
import { SuggestionGrid } from "@/components/chat/SuggestionGrid";
import type { Message } from "@/lib/types";

interface MessageFeedProps {
  messages: Message[];
  streamingText: string;
  onSuggestionPick: (prompt: string) => void;
}

interface Activity {
  user: Message;
  assistant?: Message;
}

const buildActivities = (messages: Message[]): Activity[] => {
  const activities: Activity[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      activities.push({ user: message });
      continue;
    }

    const latest = activities[activities.length - 1];
    if (latest && !latest.assistant) {
      latest.assistant = message;
    }
  }

  return activities;
};

export function MessageFeed({
  messages,
  streamingText,
  onSuggestionPick,
}: MessageFeedProps) {
  const activities = buildActivities(messages);

  if (activities.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center gap-5 px-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--wm-muted)]">
            Kick off
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-[var(--wm-text)]">
            Describe the full frontend product you want to build
          </h2>
        </div>
        <SuggestionGrid onPick={onSuggestionPick} />
      </div>
    );
  }

  return (
    <div className="space-y-3 px-2 pb-4">
      {activities.map((activity, index) => (
        <ActivityGroup
          key={activity.user.id}
          userMessage={activity.user}
          assistantMessage={activity.assistant}
          streamingText={streamingText}
          isLatest={index === activities.length - 1}
        />
      ))}
    </div>
  );
}

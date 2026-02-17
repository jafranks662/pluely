import { Button } from "@/components/ui/button";
import { LiveSummaryData, ConversationMode } from "@/types";
import { CheckCircle2, ListChecks, ListTodo, Loader2 } from "lucide-react";

type Props = {
  mode: ConversationMode;
  summary: LiveSummaryData;
  updatedAt: number | null;
  isUpdating: boolean;
  onUpdate: () => void;
  onClear: () => void;
};

export const LiveSummaryPanel = ({
  mode,
  summary,
  updatedAt,
  isUpdating,
  onUpdate,
  onClear,
}: Props) => {
  if (mode !== "meeting") {
    return null;
  }

  const formatUpdatedAt = () => {
    if (!updatedAt) return "Not updated yet";
    return `Updated ${new Date(updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold">Live Summary</h4>
          <p className="text-[10px] text-muted-foreground">{formatUpdatedAt()}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={onUpdate}
            disabled={isUpdating}
            aria-label="Update live summary now"
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Update now"
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={onClear}
            aria-label="Clear live summary"
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <ListChecks className="h-3.5 w-3.5 text-primary" />
            Rolling Summary
          </div>
          {summary.summary.length === 0 ? (
            <p className="text-[10px] text-muted-foreground mt-1">
              No summary yet.
            </p>
          ) : (
            <ul className="list-disc pl-4 text-[11px] text-muted-foreground mt-1 space-y-1">
              {summary.summary.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Decisions
          </div>
          {summary.decisions.length === 0 ? (
            <p className="text-[10px] text-muted-foreground mt-1">
              No decisions yet.
            </p>
          ) : (
            <ul className="list-disc pl-4 text-[11px] text-muted-foreground mt-1 space-y-1">
              {summary.decisions.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <ListTodo className="h-3.5 w-3.5 text-amber-500" />
            Action Items
          </div>
          {summary.actionItems.length === 0 ? (
            <p className="text-[10px] text-muted-foreground mt-1">
              No action items yet.
            </p>
          ) : (
            <ul className="text-[11px] text-muted-foreground mt-1 space-y-1">
              {summary.actionItems.map((item, index) => (
                <li key={`${item.text}-${index}`} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/70 flex-shrink-0" />
                  <span>
                    {item.text}
                    {(item.owner || item.due) && (
                      <span className="text-[10px] text-muted-foreground/70 ml-1">
                        {item.owner ? `(${item.owner}` : "("}
                        {item.due ? ` • due ${item.due}` : ""}
                        {")"}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

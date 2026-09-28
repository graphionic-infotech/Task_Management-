import { ArrowRight, Crown } from 'lucide-react';
import { getTeamMember } from '@mindwtr/core';
import { cn } from '../../../lib/utils';

interface TeamAssignmentBadgeProps {
    assignedBy?: string | null;
    assignedTo?: string | null;
    className?: string;
}

export function TeamAssignmentBadge({
    assignedBy,
    assignedTo,
    className,
}: TeamAssignmentBadgeProps) {
    const byMember = getTeamMember(assignedBy);
    const toMember = getTeamMember(assignedTo);

    if (!assignedBy && !assignedTo) return null;

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border bg-muted/30 border-border/80 text-foreground transition-all shrink-0",
                className
            )}
        >
            {/* Assigned By */}
            {assignedBy && (
                <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[10px]">From:</span>
                    <span
                        style={{ backgroundColor: byMember?.color || '#0ea5e9' }}
                        className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white shadow-xs"
                    >
                        {assignedBy.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-semibold text-foreground">
                        {assignedBy}
                    </span>
                    {byMember?.isAdmin && (
                        <span className="flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            <Crown className="w-2.5 h-2.5" />
                            Admin
                        </span>
                    )}
                </div>
            )}

            {/* Direction Arrow if both present */}
            {assignedBy && assignedTo && (
                <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0 mx-0.5 opacity-80" />
            )}

            {/* Assigned To */}
            {assignedTo && (
                <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[10px]">To:</span>
                    <span
                        style={{ backgroundColor: toMember?.color || '#6366f1' }}
                        className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white shadow-xs"
                    >
                        {assignedTo.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-semibold text-foreground">
                        {assignedTo}
                    </span>
                    {toMember?.isAdmin && (
                        <span className="flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            <Crown className="w-2.5 h-2.5" />
                            Admin
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

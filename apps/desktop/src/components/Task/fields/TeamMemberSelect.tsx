import { Check, Crown, User, Users } from 'lucide-react';
import { GRAPHIONIC_TEAM_MEMBERS } from '@mindwtr/core';
import { cn } from '../../../lib/utils';

interface TeamMemberSelectProps {
    label: string;
    value: string;
    onChange: (name: string) => void;
    allowUnassigned?: boolean;
    helperText?: string;
    className?: string;
}

export function TeamMemberSelect({
    label,
    value,
    onChange,
    allowUnassigned = false,
    helperText,
    className,
}: TeamMemberSelectProps) {
    const selectedLower = value.trim().toLowerCase();

    return (
        <div className={cn("space-y-1.5", className)}>
            <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    {label}
                </label>
                {value && (
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        Selected: <strong className="text-foreground">{value}</strong>
                    </span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {allowUnassigned && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            !value
                                ? "bg-muted text-foreground border-border ring-1 ring-primary/40 font-semibold"
                                : "bg-card text-muted-foreground border-border hover:bg-muted/50"
                        )}
                    >
                        <User className="w-3.5 h-3.5 opacity-60" />
                        Unassigned
                    </button>
                )}

                {GRAPHIONIC_TEAM_MEMBERS.map((member) => {
                    const isSelected = selectedLower === member.name.toLowerCase();
                    return (
                        <button
                            key={member.id}
                            type="button"
                            onClick={() => onChange(member.name)}
                            style={{
                                borderColor: isSelected ? member.color : undefined,
                            }}
                            className={cn(
                                "group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                isSelected
                                    ? "bg-accent/40 text-foreground ring-2 shadow-sm font-semibold"
                                    : "bg-card text-muted-foreground border-border hover:bg-accent/20 hover:text-foreground"
                            )}
                        >
                            {/* Avatar Dot with Initials */}
                            <span
                                style={{ backgroundColor: member.color }}
                                className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shadow-xs"
                            >
                                {member.name.charAt(0)}
                            </span>

                            <span>{member.name}</span>

                            {member.isAdmin && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                                    <Crown className="w-2.5 h-2.5" />
                                    Admin
                                </span>
                            )}

                            {isSelected && (
                                <Check className="w-3.5 h-3.5 text-primary ml-0.5" />
                            )}
                        </button>
                    );
                })}
            </div>

            {helperText && (
                <p className="text-[11px] text-muted-foreground">{helperText}</p>
            )}
        </div>
    );
}

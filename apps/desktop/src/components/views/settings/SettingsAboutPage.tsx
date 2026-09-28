import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { cn } from '../../../lib/utils';
import { SettingsFeedbackModal, type FeedbackSubmitInput } from './SettingsFeedbackModal';

type Labels = {
    version: string;
    installChannel: string;
    license: string;
    github: string;
    documentation: string;
    videoTutorials: string;
    privacy: string;
    terms: string;
    sponsorProject: string;
    checkForUpdates: string;
    checking: string;
    checkFailed: string;
    feedback: string;
    feedbackDesc: string;
    feedbackCategory: string;
    feedbackCategoryBug: string;
    feedbackCategoryFeature: string;
    feedbackCategoryOther: string;
    feedbackMessage: string;
    feedbackMessagePlaceholder: string;
    feedbackMessagePlaceholderBug: string;
    feedbackMessagePlaceholderFeature: string;
    feedbackMessagePlaceholderOther: string;
    feedbackWhere: string;
    feedbackWherePlaceholder: string;
    feedbackWhereMessagePrefix: string;
    feedbackWhereInbox: string;
    feedbackWhereFocus: string;
    feedbackWhereProjects: string;
    feedbackWhereReview: string;
    feedbackWhereSettings: string;
    feedbackWhereSync: string;
    feedbackWhereImportExport: string;
    feedbackWhereNotifications: string;
    feedbackWhereOther: string;
    feedbackEmail: string;
    feedbackEmailPlaceholder: string;
    feedbackIncludeDiagnostics: string;
    feedbackIncludeDiagnosticsDesc: string;
    feedbackPrivacy: string;
    feedbackSubmit: string;
    feedbackSending: string;
    feedbackSent: string;
    feedbackFailed: string;
    feedbackUnavailable: string;
    feedbackUnavailableDesc: string;
    feedbackOpenGitHubIssue: string;
    feedbackGitHubDesc: string;
    feedbackOpenGitHubDiscussion: string;
    feedbackRequired: string;
    feedbackInvalidEmail: string;
    close: string;
};

export type SettingsAboutPageProps = {
    t: Labels;
    appVersion: string;
    /** False in the web/PWA build, which updates via its Docker image. */
    updatesSupported?: boolean;
    installChannel?: string | null;
    onOpenLink: (url: string) => void;
    onCheckUpdates: () => void;
    isCheckingUpdate: boolean;
    updateActionLabel?: string;
    updateError: string | null;
    updateNotice: string | null;
    feedbackConfigured: boolean;
    onSubmitFeedback: (input: FeedbackSubmitInput) => Promise<void>;
};

export function SettingsAboutPage({
    t,
    appVersion,
    updatesSupported = true,
    installChannel,
    onOpenLink,
    onCheckUpdates,
    isCheckingUpdate,
    updateActionLabel,
    updateError,
    updateNotice,
    feedbackConfigured,
    onSubmitFeedback,
}: SettingsAboutPageProps) {
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const actionLabel = updateActionLabel ?? t.checkForUpdates;

    return (
        <>
            <div className="bg-muted/30 rounded-lg p-6 space-y-4 border border-border">
                <div data-settings-key="version" className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t.version}</span>
                    <span className="font-mono bg-muted px-2 py-1 rounded text-sm">v{appVersion}</span>
                </div>
                {installChannel && (
                    <>
                        <div className="border-t border-border/50"></div>
                        <div data-settings-key="installChannel" className="flex justify-between items-center gap-4">
                            <span className="text-muted-foreground">{t.installChannel}</span>
                            <span className="font-mono bg-muted px-2 py-1 rounded text-sm">{installChannel}</span>
                        </div>
                    </>
                )}
                {updatesSupported && (<>
                <div className="border-t border-border/50"></div>
                <div data-settings-key="checkForUpdates" className="flex justify-between items-center">
                    <span className="text-muted-foreground">{actionLabel}</span>
                    <button
                        onClick={onCheckUpdates}
                        disabled={isCheckingUpdate}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                            isCheckingUpdate
                                ? "bg-muted text-muted-foreground cursor-not-allowed"
                                : "bg-primary text-primary-foreground hover:bg-primary/90",
                        )}
                    >
                        <RefreshCw className={cn("w-4 h-4", isCheckingUpdate && "animate-spin")} />
                        {isCheckingUpdate ? t.checking : actionLabel}
                    </button>
                </div>
                </>)}
                {updateError && (
                    <div className="text-destructive text-sm">{t.checkFailed}</div>
                )}
                {updateNotice && !updateError && (
                    <div className="text-sm text-muted-foreground">{updateNotice}</div>
                )}
                <div className="border-t border-border/50"></div>
                <div className="border-t border-border/50"></div>
                <div data-settings-key="company" className="flex justify-between items-center">
                    <span className="text-muted-foreground">Organization</span>
                    <span className="font-semibold text-primary">Graphionic</span>
                </div>
                <div className="border-t border-border/50"></div>
                <div data-settings-key="license" className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t.license}</span>
                    <span className="font-medium">Enterprise Suite</span>
                </div>
            </div>
            <SettingsFeedbackModal
                isConfigured={feedbackConfigured}
                isOpen={feedbackOpen}
                onClose={() => setFeedbackOpen(false)}
                onOpenGitHub={(category) => onOpenLink(category === 'other'
                    ? 'https://github.com/dongdongbh/Mindwtr/discussions/new'
                    : 'https://github.com/dongdongbh/Mindwtr/issues/new/choose')}
                onSubmit={onSubmitFeedback}
                t={t}
            />
        </>
    );
}

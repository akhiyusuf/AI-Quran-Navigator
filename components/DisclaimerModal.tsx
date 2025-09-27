import React, { useState } from 'react';
import { IconAlertTriangle, IconUser, IconLink, IconSparkles, IconShieldCheck, IconBookOpen, IconArrowDown, IconChevronDown } from './Icons';

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FlowchartStep: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="flex items-start gap-4 text-left">
    <div className="flex-shrink-0 bg-[var(--muted)] text-[var(--muted-foreground)] rounded-full h-10 w-10 flex items-center justify-center border border-[var(--border)]">
      {icon}
    </div>
    <div>
      <h4 className="font-semibold text-sm text-[var(--foreground)]">{title}</h4>
      <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
    </div>
  </div>
);

const ArrowConnector = () => (
    <div className="h-6 flex">
        <div className="w-10 flex-shrink-0 flex justify-center items-center">
            <IconArrowDown className="h-4 w-4 text-[var(--border)]" />
        </div>
    </div>
);

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, onClose }) => {
  const [showAccuracyDetails, setShowAccuracyDetails] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--overlay)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div
        className="relative w-full max-w-lg bg-[var(--card)] rounded-lg shadow-xl m-4 p-6 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex flex-col items-center text-center">
          <div className="p-3 bg-yellow-100 rounded-full mb-4">
            <IconAlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>

          <h3 className="text-xl font-bold text-[var(--foreground)] mb-2" id="disclaimer-title">
            Important Notice
          </h3>

          <div className="text-sm text-[var(--muted-foreground)] space-y-3 my-4">
            <p>
              This application is in active development. Features may change, and bugs may be present.
            </p>
            <p>
              While verse citations are validated for accuracy, the AI's interpretation is an experimental tool to assist your exploration and may contain inaccuracies.
            </p>
            <p className="font-semibold text-[var(--foreground)]">
              Please always verify information with reliable scholarly sources.
            </p>
          </div>
          
          <div className="w-full border-t border-[var(--border)] my-4"></div>

          <button
            onClick={() => setShowAccuracyDetails(prev => !prev)}
            className="flex items-center justify-center gap-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-expanded={showAccuracyDetails}
          >
            <span>How We Ensure Accuracy</span>
            <IconChevronDown className={`h-4 w-4 transition-transform ${showAccuracyDetails ? 'rotate-180' : ''}`} />
          </button>

          {showAccuracyDetails && (
             <div className="w-full mt-4 pt-4 text-left">
                <div className="flex flex-col">
                    <FlowchartStep
                        icon={<IconUser className="h-5 w-5" />}
                        title="1. You Ask a Question"
                        description="Your query is sent to the AI to find relevant topics and verses."
                    />
                    <ArrowConnector />
                    <FlowchartStep
                        icon={<IconLink className="h-5 w-5" />}
                        title="2. AI Performs a Grounded Search"
                        description="The AI consults reliable web sources to form its interpretation."
                    />
                    <ArrowConnector />
                    <FlowchartStep
                        icon={<IconSparkles className="h-5 w-5" />}
                        title="3. AI Synthesizes a Response"
                        description="It writes a summary and cites Quran verses it believes are relevant (e.g., 2:153)."
                    />
                    <ArrowConnector />
                    <FlowchartStep
                        icon={<IconShieldCheck className="h-5 w-5 text-green-600" />}
                        title="4. CRITICAL: App Validates Verses"
                        description="Our app intercepts the AI's response. Every verse citation is checked against our built-in, verified Quran data."
                    />
                    <ArrowConnector />
                    <FlowchartStep
                        icon={<IconBookOpen className="h-5 w-5" />}
                        title="5. Verified Information is Displayed"
                        description="Only 100% valid verses are shown in the viewer. Incorrect AI citations are discarded."
                    />
                </div>
            </div>
          )}

          <button
            type="button"
            className="w-full mt-6 px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-semibold hover:bg-[var(--primary-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--ring)]"
            onClick={onClose}
            aria-label="Acknowledge and close disclaimer"
          >
            I Understand and Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};
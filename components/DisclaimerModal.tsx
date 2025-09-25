import React, { useState } from 'react';
import { IconAlertTriangle, IconUser, IconLink, IconSparkles, IconShieldCheck, IconBookOpen, IconArrowDown } from './Icons';

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FlowchartStep: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="flex items-start gap-4">
    <div className="flex-shrink-0 bg-slate-100 text-slate-600 rounded-full h-12 w-12 flex items-center justify-center border border-slate-200">
      {icon}
    </div>
    <div>
      <h4 className="font-semibold text-slate-800">{title}</h4>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  </div>
);

const ArrowConnector = () => (
    <div className="h-8 flex">
        <div className="w-12 flex-shrink-0 flex justify-center items-center">
            <IconArrowDown className="h-5 w-5 text-slate-300" />
        </div>
    </div>
);

const FlowchartView: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <>
    <div className="flex flex-col items-center text-center">
      <div className="p-3 bg-blue-100 rounded-full mb-4">
        <IconShieldCheck className="h-8 w-8 text-blue-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2" id="disclaimer-title">
        How We Ensure Accuracy
      </h3>
      <p className="text-sm text-slate-600 mb-6">
        This app uses a multi-step process to ensure that even with an AI, the Quranic verses you see are always accurate.
      </p>
    </div>

    <div className="flex flex-col">
      <FlowchartStep
        icon={<IconUser className="h-6 w-6" />}
        title="1. You Ask a Question"
        description="Your query is sent to the AI to find relevant topics and verses."
      />
      <ArrowConnector />
      <FlowchartStep
        icon={<IconLink className="h-6 w-6" />}
        title="2. AI Performs a Grounded Search"
        description="The AI consults reliable web sources to form its interpretation."
      />
       <ArrowConnector />
      <FlowchartStep
        icon={<IconSparkles className="h-6 w-6" />}
        title="3. AI Synthesizes a Response"
        description="It writes a summary and cites Quran verses it believes are relevant (e.g., 2:153)."
      />
       <ArrowConnector />
      <FlowchartStep
        icon={<IconShieldCheck className="h-6 w-6 text-green-600" />}
        title="4. CRITICAL: App Validates Verses"
        description="Our app intercepts the AI's response. Every verse citation is checked against our built-in, verified Quran data."
      />
       <ArrowConnector />
       <FlowchartStep
        icon={<IconBookOpen className="h-6 w-6" />}
        title="5. Verified Information is Displayed"
        description="Only 100% valid verses are shown in the viewer. Incorrect AI citations are discarded."
      />
    </div>

    <button
      type="button"
      className="w-full mt-8 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      onClick={onNext}
      aria-label="Next step"
    >
      Next
    </button>
  </>
);


const DisclaimerView: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <>
        <div className="flex flex-col items-center text-center">
          <div className="p-3 bg-yellow-100 rounded-full mb-4">
            <IconAlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2" id="disclaimer-title-2">
            Important Notice
          </h3>

          <div className="text-sm text-slate-600 space-y-3 my-4">
            <p>
              This application is currently in active development. Features may change, and you may encounter bugs.
            </p>
            <p>
              While verse citations are validated, the AI's interpretation is still an experimental tool to assist your exploration. The AI may misinterpret queries or its summary may contain inaccuracies.
            </p>
            <p className="font-semibold text-slate-700">
              Please always verify the AI's interpretation with reliable scholarly sources.
            </p>
          </div>
          
          <button
            type="button"
            className="w-full mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={onClose}
            aria-label="Acknowledge and close disclaimer"
          >
            I Understand and Acknowledge
          </button>
        </div>
    </>
);


export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    // Reset to step 1 for the next time it opens
    setTimeout(() => setStep(1), 300);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-lg shadow-xl m-4 p-6 max-h-[85vh] overflow-y-auto"
      >
        {step === 1 && <FlowchartView onNext={() => setStep(2)} />}
        {step === 2 && <DisclaimerView onClose={handleClose} />}
      </div>
    </div>
  );
};
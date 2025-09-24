import React from 'react';
import { IconAlertTriangle } from './Icons';

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-lg shadow-xl m-4 p-6"
      >
        <div className="flex flex-col items-center text-center">
          <div className="p-3 bg-yellow-100 rounded-full mb-4">
            <IconAlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2" id="disclaimer-title">
            Disclaimer & Important Notice
          </h3>

          <div className="text-sm text-slate-600 space-y-3 my-4">
            <p>
              This application is currently in active development. Features may change, and you may encounter bugs.
            </p>
            <p>
              The AI-powered search is an experimental tool to assist your exploration of the Quran. While safeguards are in place, the AI may still occasionally misinterpret queries or point to incorrect verses. It is not a substitute for scholarly guidance.
            </p>
            <p className="font-semibold text-slate-700">
              Please always verify the verses and their context using reliable sources.
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
      </div>
    </div>
  );
};
import React from 'react';
import { ChevronDown, ChevronRight, BarChart2, CheckCircle, Database } from 'lucide-react';
import { VersionInfoBanner } from './VersionInfoBanner';

interface ComparativesViewProps {
  activeRealVersionName?: string;
}

const ComparativesView: React.FC<ComparativesViewProps> = ({ activeRealVersionName }) => {
  return (
    <div className="p-8 max-w-[1600px] mx-auto pb-32">
      <VersionInfoBanner versionName={activeRealVersionName} />
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Comparativos (Real x Meta x LY)</h2>
      </div>
      <p className="text-gray-600">Visualização de comparativos em desenvolvimento.</p>
    </div>
  );
};

export default ComparativesView;

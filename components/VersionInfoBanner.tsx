import React from 'react';
import { Info } from 'lucide-react';

interface VersionInfoBannerProps {
    versionName?: string;
}

export const VersionInfoBanner: React.FC<VersionInfoBannerProps> = ({ versionName }) => {
    if (!versionName) return null;
    return (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center gap-2 mb-6 text-sm font-medium">
            <Info size={18} />
            Visualizando dados da versão: {versionName}
        </div>
    );
};

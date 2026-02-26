
import React from 'react';

const iconProps = {
  className: "w-6 h-6",
  strokeWidth: 2,
};

export const HomeIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

export const BookOpenIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.246.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

export const ClipboardListIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

export const DocumentTextIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export const AppleIcon = () => (
  <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5a.5.5 0 01.5.5v1.5a.5.5 0 01-1 0V5a.5.5 0 01.5-.5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6c-4.4 0-6 3.5-6 7 0 4 3 7 6 7s6-3 6-7c0-3.5-1.6-7-6-7z" />
  </svg>
);

export const MicrophoneIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5a6 6 0 00-12 0v1.5a6 6 0 006 6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75a3 3 0 013-3v-1.5a3 3 0 00-6 0v1.5a3 3 0 013 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75V21m-3.75-3.75H6a2.25 2.25 0 01-2.25-2.25v-1.5a2.25 2.25 0 012.25-2.25h2.25m6 6h2.25a2.25 2.25 0 002.25-2.25v-1.5a2.25 2.25 0 00-2.25-2.25H15" />
  </svg>
);

export const UploadIcon = () => (
    <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
);

export const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const PencilSquareIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

export const InfoCircleIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const SparklesIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
);

export const LightBulbIcon = ({ className }: { className?: string }) => (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.311a7.5 7.5 0 00-7.5 0c.247.64.72 1.252 1.27 1.765A9.75 9.75 0 0012 21.75a9.75 9.75 0 005.23-1.675c.55-.513 1.023-1.125 1.27-1.765z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

export interface AvatarProps {
  className?: string;
}

export const Avatar1 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <circle cx="18" cy="18" r="18" fill="#FFCC80"/>
        <path d="M7 10L10 18H26L29 10L18 5L7 10Z" fill="#E65100"/>
        <circle cx="18" cy="18" r="16" fill="#FFA726"/>
        <circle cx="12" cy="16" r="2" fill="white"/>
        <circle cx="12" cy="16" r="1" fill="#1A237E"/>
        <circle cx="24" cy="16" r="2" fill="white"/>
        <circle cx="24" cy="16" r="1" fill="#1A237E"/>
        <path d="M16 20C16 20 17 21 18 21C19 21 20 20 20 20V22C20 22 19 23 18 23C17 23 16 22 16 22V20Z" fill="#3E2723"/>
        <path d="M4 18H10" stroke="#3E2723" strokeWidth="1" strokeLinecap="round"/>
        <path d="M4 20H10" stroke="#3E2723" strokeWidth="1" strokeLinecap="round"/>
        <path d="M26 18H32" stroke="#3E2723" strokeWidth="1" strokeLinecap="round"/>
        <path d="M26 20H32" stroke="#3E2723" strokeWidth="1" strokeLinecap="round"/>
    </svg>
);

export const Avatar2 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <circle cx="18" cy="18" r="18" fill="#90CAF9"/>
        <circle cx="18" cy="18" r="15" fill="#E1BEE7"/>
        <path d="M8 12C8 12 6 18 10 24" stroke="#4A148C" strokeWidth="3" strokeLinecap="round"/>
        <path d="M28 12C28 12 30 18 26 24" stroke="#4A148C" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="18" cy="19" r="12" fill="#F5F5F5"/>
        <circle cx="14" cy="16" r="1.5" fill="#333"/>
        <circle cx="22" cy="16" r="1.5" fill="#333"/>
        <ellipse cx="18" cy="20" rx="3" ry="2" fill="#333"/>
        <path d="M18 22V24" stroke="#333" strokeWidth="1.5"/>
        <path d="M15 25C15 25 16.5 26 18 26C19.5 26 21 25 21 25" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M17 26C17 26 17.5 29 18 29C18.5 29 19 26 19 26" fill="#E57373"/>
    </svg>
);

export const Avatar3 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <circle cx="18" cy="18" r="18" fill="#A5D6A7"/>
        <circle cx="8" cy="10" r="4" fill="#795548"/>
        <circle cx="28" cy="10" r="4" fill="#795548"/>
        <circle cx="18" cy="18" r="14" fill="#8D6E63"/>
        <circle cx="18" cy="22" r="6" fill="#D7CCC8"/>
        <circle cx="14" cy="16" r="1.5" fill="#3E2723"/>
        <circle cx="22" cy="16" r="1.5" fill="#3E2723"/>
        <ellipse cx="18" cy="20" rx="2" ry="1.5" fill="#3E2723"/>
        <path d="M18 22V23" stroke="#3E2723" strokeWidth="1"/>
        <path d="M16 23C16 23 17 24 18 24C19 24 20 23 20 23" stroke="#3E2723" strokeWidth="1" strokeLinecap="round"/>
    </svg>
);

export const Avatar4 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <circle cx="18" cy="18" r="18" fill="#FFAB91"/>
        <path d="M6 10L12 24L18 28L24 24L30 10L18 6L6 10Z" fill="#E64A19"/>
        <path d="M10 12L18 28L26 12L18 16L10 12Z" fill="#FFCCBC"/>
        <circle cx="15" cy="16" r="1.5" fill="#333"/>
        <circle cx="21" cy="16" r="1.5" fill="#333"/>
        <circle cx="18" cy="22" r="1.5" fill="#333"/>
    </svg>
);

export const Avatar5 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <circle cx="18" cy="18" r="18" fill="#B39DDB"/>
        <path d="M8 8L12 14H24L28 8L18 4L8 8Z" fill="#5E35B1"/>
        <circle cx="18" cy="19" r="13" fill="#673AB7"/>
        <circle cx="13" cy="17" r="4" fill="white"/>
        <circle cx="23" cy="17" r="4" fill="white"/>
        <circle cx="13" cy="17" r="1.5" fill="#333"/>
        <circle cx="23" cy="17" r="1.5" fill="#333"/>
        <path d="M18 20L16 23H20L18 20Z" fill="#FFC107"/>
        <path d="M10 26C10 26 14 30 18 26C22 30 26 26 26 26" stroke="#9575CD" strokeWidth="2" strokeLinecap="round"/>
    </svg>
);

export const Avatar6 = ({className}: AvatarProps) => (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || "w-12 h-12"}>
        <circle cx="18" cy="18" r="18" fill="#80CBC4"/>
        <circle cx="8" cy="14" r="5" fill="#9E9E9E"/>
        <circle cx="28" cy="14" r="5" fill="#9E9E9E"/>
        <circle cx="18" cy="18" r="13" fill="#BDBDBD"/>
        <circle cx="14" cy="16" r="1.5" fill="#333"/>
        <circle cx="22" cy="16" r="1.5" fill="#333"/>
        <ellipse cx="18" cy="20" rx="3" ry="4" fill="#424242"/>
    </svg>
);

export const avatars: React.FC<AvatarProps>[] = [Avatar1, Avatar2, Avatar3, Avatar4, Avatar5, Avatar6];

import React from 'react';
import { Tone } from '../lib/format';

const btnVariants: Record<string, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof btnVariants;
    size?: 'sm' | 'md';
  }
> = ({ variant = 'primary', size = 'md', className = '', children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
      size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
    } ${btnVariants[variant]} ${className}`}
  >
    {children}
  </button>
);

const toneClasses: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
  violet: 'bg-violet-100 text-violet-700',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'slate', children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${toneClasses[tone]}`}>
    {children}
  </span>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title,
  subtitle,
  action,
}) => (
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: Tone }> = ({
  label,
  value,
  hint,
  tone = 'blue',
}) => (
  <Card className="p-5">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
    {hint && <p className={`text-xs mt-2 inline-flex px-2 py-0.5 rounded ${toneClasses[tone]}`}>{hint}</p>}
  </Card>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string; hint?: string }> = ({
  label,
  children,
  className = '',
  hint,
}) => (
  <label className={`block ${className}`}>
    <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
  </label>
);

const controlClass =
  'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => <input ref={ref} {...props} className={`${controlClass} ${className}`} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...props }) => (
  <select {...props} className={`${controlClass} ${className}`}>
    {children}
  </select>
);

export const SearchSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, options, placeholder = 'Secin', className = '' }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  const filteredOptions = options.filter((o) => (o.label || '').toLowerCase().includes((query || '').trim().toLowerCase()));

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        readOnly
        value={selectedLabel}
        onClick={() => setOpen((o) => !o)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara..."
            className="w-full px-3 py-2 text-sm border-b border-slate-200 outline-none"
          />
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">Sonuc bulunamadi</div>
          ) : (
            filteredOptions.map((o) => (
              <button key={o.value} type="button" onClick={() => handleSelect(o.value)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...props }) => (
  <textarea {...props} className={`${controlClass} ${className}`} />
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ open, onClose, title, children, footer, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} bg-white rounded-xl shadow-2xl my-8`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            ×
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export const Table: React.FC<{ head: React.ReactNode[]; children: React.ReactNode }> = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
          {head.map((h, i) => (
            <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </div>
);

export const Empty: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="text-center py-10">
    <p className="text-sm font-medium text-slate-600">{title}</p>
    {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
  </div>
);

export const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
  </div>
);

export const LoadingText: React.FC<{ text?: string }> = ({ text = 'Yükleniyor...' }) => (
  <p className="text-sm text-slate-400 py-6 text-center">{text}</p>
);

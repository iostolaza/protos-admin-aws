/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['var(--font-inter)'],
        roboto: ['var(--font-roboto)'],
      },
      boxShadow: {
        'custom-lg': '0 10px 30px -10px rgba(82,63,105,0.15)',
        'elevation-100': '0 1px 2px rgba(16,24,40,0.05)',
        'elevation-200': '0 4px 12px rgba(16,24,40,0.08)',
      },
      colors: {
        'primary': 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        'success': 'var(--success)',
        'success-foreground': 'var(--success-foreground)',
        'destructive': 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        'muted': 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        'card': 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        'background': 'var(--background)',
        'foreground': 'var(--foreground)',
        'border': 'var(--border)',
        'text-heading': 'var(--text-heading)',
        'text-body': 'var(--text-body)',
        'text-label': 'var(--text-label)',
        'text-placeholder': 'var(--text-placeholder)',
        'text-muted': 'var(--text-muted)',
      },
      borderRadius: {
        'card': '1rem',
      },
    },
  },
  safelist: [
    'group-hover:hidden',
    'group-hover:block',
    'group', // Added: Enables base group class for group-hover
  ],
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('tailwind-scrollbar'),
  ],
};
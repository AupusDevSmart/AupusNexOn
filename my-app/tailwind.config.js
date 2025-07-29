import * as tailwindcssAnimate from 'tailwindcss-animate';

const config = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	prefix: '',
	theme: {
		container: {
			center: 'true',
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
			colors: {
				status: {
					'waiting-for-evaluation': {
						DEFAULT: '#fef08a',
						foreground: '#713f12'
					},
					'under-evaluation': {
						DEFAULT: '#facc15',
						foreground: '#713f12'
					},
					'waiting-for-approval': {
						DEFAULT: '#f97316',
						foreground: '#7c2d12'
					},
					'budget-approved': {
						DEFAULT: '#bbf7d0',
						foreground: '#064e3b'
					},
					'waiting-for-parts': {
						DEFAULT: '#86efac',
						foreground: '#065f46'
					},
					'waiting-for-repair': {
						DEFAULT: '#22c55e',
						foreground: '#14532d'
					},
					'ready-notify-client': {
						DEFAULT: '#93c5fd',
						foreground: '#1e3a8a'
					},
					'ready-waiting-pickup': {
						DEFAULT: '#3b82f6',
						foreground: '#1e40af'
					},
					'ready-delivered-pickedup': {
						DEFAULT: '#1e3a8a',
						foreground: '#93c5fd'
					},
					'budget-rejected': {
						DEFAULT: '#f87171',
						foreground: '#7f1d1d'
					},
					'pickedup-no-repair': {
						DEFAULT: '#b91c1c',
						foreground: '#fee2e2'
					},
					'waiting-pickup': {
						DEFAULT: '#a3a3a3',
						foreground: '#374151'
					},
					'no-conditions-repair': {
						DEFAULT: '#4b5563',
						foreground: '#d1d5db'
					}
				},
				border: {
					DEFAULT: 'var(--border)',
					hover: 'var(--border-hover)'
				},
				input: {
					DEFAULT: 'var(--input)',
					hover: 'var(--input-hover)'
				},
				ring: {
					DEFAULT: 'var(--ring)',
					hover: 'var(--ring-hover)'
				},
				background: {
					DEFAULT: 'var(--background)',
					hover: 'var(--background-hover)'
				},
				foreground: {
					DEFAULT: 'var(--foreground)',
					hover: 'var(--foreground-hover)'
				},
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--primary-foreground)',
					hover: 'var(--primary-hover)',
					'foreground-hover': 'var(--primary-foreground-hover)'
				},
				secondary: {
					DEFAULT: 'var(--secondary)',
					foreground: 'var(--secondary-foreground)',
					hover: 'var(--secondary-hover)',
					'foreground-hover': 'var(--secondary-foreground-hover)'
				},
				tertiary: {
					DEFAULT: 'var(--tertiary)',
					foreground: 'var(--tertiary-foreground)',
					hover: 'var(--tertiary-hover)',
					'foreground-hover': 'var(--tertiary-foreground-hover)'
				},
				info: {
					DEFAULT: 'var(--info)',
					foreground: 'var(--info-foreground)',
					hover: 'var(--info-hover)',
					'foreground-hover': 'var(--info-foreground-hover)'
				},
				success: {
					DEFAULT: 'var(--success)',
					foreground: 'var(--success-foreground)',
					hover: 'var(--success-hover)',
					'foreground-hover': 'var(--success-foreground-hover)'
				},
				warning: {
					DEFAULT: 'var(--warning)',
					foreground: 'var(--warning-foreground)',
					hover: 'var(--warning-hover)',
					'foreground-hover': 'var(--warning-foreground-hover)'
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					foreground: 'var(--destructive-foreground)',
					hover: 'var(--destructive-hover)',
					'foreground-hover': 'var(--destructive-foreground-hover)'
				},
				muted: {
					DEFAULT: 'var(--muted)',
					foreground: 'var(--muted-foreground)',
					hover: 'var(--muted-hover)',
					'foreground-hover': 'var(--muted-foreground-hover)'
				},
				accent: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--accent-foreground)',
					hover: 'var(--accent-hover)',
					'foreground-hover': 'var(--accent-foreground-hover)'
				},
				popover: {
					DEFAULT: 'var(--popover)',
					foreground: 'var(--popover-foreground)',
					hover: 'var(--popover-hover)',
					'foreground-hover': 'var(--popover-foreground-hover)'
				},
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)',
					hover: 'var(--card-hover)',
					'foreground-hover': 'var(--card-foreground-hover)'
				},
				'sent-message-baloon': {
					DEFAULT: 'var(--sent-message-baloon)',
					foreground: 'var(--sent-message-baloon-foreground)',
					hover: 'var(--sent-message-baloon-hover)',
					'foreground-hover': 'var(--sent-message-baloon-foreground-hover)'
				},
				'received-message-baloon': {
					DEFAULT: 'var(--received-message-baloon)',
					foreground: 'var(--received-message-baloon-foreground)',
					hover: 'var(--received-message-baloon-hover)',
					'foreground-hover': 'var(--received-message-baloon-foreground-hover)'
				},
				whatsapp: {
					DEFAULT: 'hsl(120, 61%, 35%)',
					foreground: 'hsl(0, 0%, 100%)',
					hover: 'hsl(120, 56%, 30%)',
					'foreground-hover': 'hsl(0, 0%, 95%)'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 4px)',
				sm: 'calc(var(--radius) - 8px)',
				xs: 'calc(var(--radius) - 12px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'collapsible-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-collapsible-content-height)'
					}
				},
				'collapsible-up': {
					from: {
						height: 'var(--radix-collapsible-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'collapsible-down': 'collapsible-down 0.2s ease-out',
				'collapsible-up': 'collapsible-up 0.2s ease-out'
			}
		}
	},
	plugins: [tailwindcssAnimate],
};

export default config;
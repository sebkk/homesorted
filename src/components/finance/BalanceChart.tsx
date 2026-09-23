'use client'

import { useTranslations } from 'next-intl'
import { useMonthFormat } from '@/i18n/useFormat'
import { useMoney } from '@/components/finance/MoneyContext'
import { useRef, useState } from 'react'

export interface ChartMonth {
	month: string
	income: number
	expense: number
	saving: number
}

const TIP_W = 176

export function BalanceChart({
	data,
	onBarClick,
}: {
	data: ChartMonth[]
	onBarClick?: (month: string) => void
}) {
	const { fmt } = useMoney()
	const t = useTranslations('chart')
	const { month: monthLabel, monthShort } = useMonthFormat()
	const wrapRef = useRef<HTMLDivElement>(null)
	const [tip, setTip] = useState<{ x: number; y: number; d: ChartMonth } | null>(
		null,
	)

	const w = 400,
		h = 150,
		padL = 4,
		padR = 4,
		padTop = 10,
		padBottom = 22
	const usableH = h - padTop - padBottom
	const baseY = padTop + usableH
	const maxTotal = Math.max(
		1,
		...data.map(d => d.income + d.expense + d.saving),
	)
	const gap = (w - padL - padR) / Math.max(data.length, 1)
	const barW = gap * 0.5
	const GAP_PX = 2

	// Anchor the tooltip above the column, clamped so it never leaves the
	// chart's box (it used to overflow and cause horizontal page scroll).
	function showTip(d: ChartMonth, column: SVGRectElement, stackTopY: number) {
		const wrap = wrapRef.current
		if (!wrap) return
		const wrapRect = wrap.getBoundingClientRect()
		const colRect = column.getBoundingClientRect()
		const scale = colRect.height / (baseY - padTop)
		const centerX = colRect.left - wrapRect.left + colRect.width / 2
		const half = TIP_W / 2
		setTip({
			x: Math.min(Math.max(centerX, half), wrapRect.width - half),
			y: colRect.top - wrapRect.top + (stackTopY - padTop) * scale,
			d,
		})
	}

	return (
		<div ref={wrapRef} className='relative'>
			<svg
				viewBox={`0 0 ${w} ${h}`}
				className='w-full h-auto block overflow-visible'
				onMouseLeave={() => setTip(null)}
			>
				<line
					x1={padL}
					y1={baseY}
					x2={w - padR}
					y2={baseY}
					stroke='var(--border)'
					strokeWidth={1}
				/>
				{data.map((d, i) => {
					const cx = padL + gap * i + gap / 2
					const incH = Math.max(
						d.income > 0 ? 3 : 0,
						(d.income / maxTotal) * usableH,
					)
					const expH = Math.max(
						d.expense > 0 ? 3 : 0,
						(d.expense / maxTotal) * usableH,
					)
					const savH = Math.max(
						d.saving > 0 ? 3 : 0,
						(d.saving / maxTotal) * usableH,
					)
					const incY = baseY - incH
					const expY = incY - (incH ? GAP_PX : 0) - expH
					const savY = expY - (expH ? GAP_PX : 0) - savH
					const stackTop = Math.min(incY, expY, savY)
					const label = t('aria', { month: monthLabel(d.month), income: fmt(d.income), expense: fmt(d.expense), saving: fmt(d.saving) })

					return (
						<g key={d.month}>
							{d.income > 0 && (
								<rect x={cx - barW / 2} y={incY} width={barW} height={incH} rx={2.5} fill='var(--good)' />
							)}
							{d.expense > 0 && (
								<rect x={cx - barW / 2} y={expY} width={barW} height={expH} rx={2.5} fill='var(--critical)' />
							)}
							{d.saving > 0 && (
								<rect x={cx - barW / 2} y={savY} width={barW} height={savH} rx={2.5} fill='var(--cat1)' />
							)}
							<text
								x={cx}
								y={h - 6}
								textAnchor='middle'
								fontSize={9.5}
								fill='var(--ink-faint)'
							>
								{monthShort(d.month)}
							</text>
							{/* Hit target: the whole column, much larger than the thin bars. */}
							<rect
								x={padL + gap * i}
								y={padTop}
								width={gap}
								height={baseY - padTop}
								fill='transparent'
								className='cursor-pointer outline-none'
								role='button'
								tabIndex={0}
								aria-label={`${label}. ${t('openStats')}`}
								onMouseEnter={e => showTip(d, e.currentTarget, stackTop)}
								onFocus={e => showTip(d, e.currentTarget, stackTop)}
								onBlur={() => setTip(null)}
								onClick={() => {
									setTip(null)
									onBarClick?.(d.month)
								}}
								onKeyDown={e => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault()
										onBarClick?.(d.month)
									}
								}}
							/>
						</g>
					)
				})}
			</svg>
			<div className='flex gap-3 justify-center pt-0.5'>
				<LegendItem color='var(--good)' label={t('income')} />
				<LegendItem color='var(--critical)' label={t('expenses')} />
				<LegendItem color='var(--cat1)' label={t('savings')} />
			</div>
			{tip && (
				<div
					className='absolute pointer-events-none z-[5] bg-[#141a20] text-white text-[11.5px] px-2.5 py-2 rounded-md tabular-nums shadow-glass'
					style={{
						left: tip.x,
						top: tip.y,
						width: TIP_W,
						transform: 'translate(-50%, calc(-100% - 6px))',
					}}
				>
					<div className='font-bold mb-1'>{monthLabel(tip.d.month)}</div>
					<TipRow color='var(--good)' label={t('income')} value={tip.d.income} />
					<TipRow color='var(--critical)' label={t('expenses')} value={tip.d.expense} />
					<TipRow color='var(--cat1)' label={t('savings')} value={tip.d.saving} />
				</div>
			)}
		</div>
	)
}

function TipRow({ color, label, value }: { color: string; label: string; value: number }) {
	const { fmt } = useMoney();
	return (
		<div className='flex items-center gap-1.5 leading-snug'>
			<span className='w-2 h-2 rounded-[2.5px] shrink-0' style={{ background: color }} />
			<span className='flex-1 text-white/75'>{label}</span>
			<span className='font-semibold'>{fmt(value)}</span>
		</div>
	)
}

function LegendItem({ color, label }: { color: string; label: string }) {
	return (
		<span className='flex items-center gap-1 text-[10.5px] font-semibold text-ink-muted'>
			<span
				className='w-2 h-2 rounded-[2.5px] shrink-0'
				style={{ background: color }}
			/>
			{label}
		</span>
	)
}

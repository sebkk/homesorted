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

const TIP_W = 204

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

	// A column's full height is the month's income (its 100%); expenses and
	// savings are stacked inside it from the bottom and the rest (green) is
	// what's left. Overspending makes the column taller than the income, whose
	// level is then marked with a line.
	const saved = (d: ChartMonth) => Math.max(0, d.saving)
	const maxTotal = Math.max(
		1,
		...data.map(d => Math.max(d.income, d.expense + saved(d))),
	)
	// Reference lines at the tallest column and at half of it, labelled in a
	// left gutter sized to the longer label so text never overlaps a column.
	const maxLabel = fmt(maxTotal)
	const halfLabel = fmt(maxTotal / 2)
	const LABEL_FONT = 9.5
	const gutter = Math.ceil(Math.max(maxLabel.length, halfLabel.length) * LABEL_FONT * 0.56) + 6

	const w = 400,
		h = 150,
		padL = gutter,
		padR = 4,
		padTop = 10,
		padBottom = 22
	const usableH = h - padTop - padBottom
	const baseY = padTop + usableH
	const halfY = padTop + usableH / 2
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
				{data.length > 0 && maxTotal > 1 && (
					<g aria-hidden>
						{[
							{ y: padTop, label: maxLabel },
							{ y: halfY, label: halfLabel },
						].map(ref => (
							<g key={ref.y}>
								<line
									x1={padL}
									y1={ref.y}
									x2={w - padR}
									y2={ref.y}
									stroke='var(--ink-faint)'
									strokeOpacity={0.55}
									strokeWidth={1}
									strokeDasharray='3 3'
								/>
								<text
									x={padL - 5}
									y={ref.y}
									textAnchor='end'
									dominantBaseline='middle'
									fontSize={LABEL_FONT}
									fill='var(--ink-faint)'
									className='tabular-nums'
								>
									{ref.label}
								</text>
							</g>
						))}
					</g>
				)}
				{data.map((d, i) => {
					const cx = padL + gap * i + gap / 2
					const toH = (v: number) => Math.max(v > 0 ? 3 : 0, (v / maxTotal) * usableH)
					const leftover = d.income - d.expense - saved(d)
					const expH = toH(d.expense)
					const savH = toH(saved(d))
					const leftH = toH(leftover)
					const expY = baseY - expH
					const savY = expY - (expH ? GAP_PX : 0) - savH
					const leftY = savY - (savH || expH ? GAP_PX : 0) - leftH
					const stackTop = Math.min(expY, savY, leftY)
					// Income level, drawn only when spending went past it.
					const incomeY = leftover < 0 && d.income > 0 ? baseY - (d.income / maxTotal) * usableH : null
					const label = t('aria', { month: monthLabel(d.month), income: fmt(d.income), expense: fmt(d.expense), saving: fmt(d.saving), left: fmt(leftover) })

					return (
						<g key={d.month}>
							{d.expense > 0 && (
								<rect x={cx - barW / 2} y={expY} width={barW} height={expH} rx={2.5} fill='var(--critical)' />
							)}
							{saved(d) > 0 && (
								<rect x={cx - barW / 2} y={savY} width={barW} height={savH} rx={2.5} fill='var(--cat1)' />
							)}
							{leftover > 0 && (
								<rect x={cx - barW / 2} y={leftY} width={barW} height={leftH} rx={2.5} fill='var(--good)' />
							)}
							{incomeY !== null && (
								// Dim what's above the income level: the overspent part.
								<rect
									x={cx - barW / 2}
									y={stackTop}
									width={barW}
									height={Math.max(0, incomeY - stackTop)}
									fill='var(--bg)'
									fillOpacity={0.5}
								/>
							)}
							{incomeY !== null && (
								<line
									x1={cx - barW / 2 - 4}
									y1={incomeY}
									x2={cx + barW / 2 + 4}
									y2={incomeY}
									stroke='var(--ink)'
									strokeWidth={2}
									strokeLinecap='round'
								/>
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
				<LegendItem color='var(--critical)' label={t('expenses')} />
				<LegendItem color='var(--cat1)' label={t('savings')} />
				<LegendItem color='var(--good)' label={t('leftover')} />
			</div>
			<div className='text-[10.5px] text-ink-faint text-center pt-1 leading-snug'>{t('caption')}</div>
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
					<TipRow label={t('income')} value={tip.d.income} />
					<TipRow color='var(--critical)' label={t('expenses')} value={tip.d.expense} />
					<TipRow color='var(--cat1)' label={t('savings')} value={tip.d.saving} />
					{(() => {
						const left = tip.d.income - tip.d.expense - saved(tip.d)
						return left >= 0 ? (
							<TipRow color='var(--good)' label={t('leftover')} value={left} />
						) : (
							<TipRow label={t('overIncome')} value={-left} />
						)
					})()}
				</div>
			)}
		</div>
	)
}

function TipRow({ color, label, value }: { color?: string; label: string; value: number }) {
	const { fmt } = useMoney();
	return (
		<div className='flex items-center gap-1.5 leading-snug'>
			<span className='w-2 h-2 rounded-[2.5px] shrink-0' style={{ background: color ?? 'transparent', border: color ? undefined : '1.5px solid rgba(255,255,255,0.75)' }} />
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

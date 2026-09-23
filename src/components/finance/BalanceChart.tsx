'use client'

import { fmt, monthLabel, monthShort } from '@/lib/finance'
import { useState } from 'react'

export interface ChartMonth {
	month: string
	income: number
	expense: number
	saving: number
}

export function BalanceChart({
	data,
	onBarClick,
}: {
	data: ChartMonth[]
	onBarClick?: (month: string) => void
}) {
	const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(
		null,
	)

	const w = 400,
		h = 150,
		padL = 4,
		padR = 4,
		padTop = 10,
		padBottom = 22
	const usableH = h - padTop - padBottom
	const maxTotal = Math.max(
		1,
		...data.map(d => d.income + d.expense + d.saving),
	)
	const barW = ((w - padL - padR) / Math.max(data.length, 1)) * 0.5
	const gap = (w - padL - padR) / Math.max(data.length, 1)
	const GAP_PX = 2

	return (
		<div className='relative'>
			<svg
				viewBox={`0 0 ${w} ${h}`}
				className='w-full h-auto block overflow-visible'
			>
				<line
					x1={padL}
					y1={padTop + usableH}
					x2={w - padR}
					y2={padTop + usableH}
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
					const baseY = padTop + usableH
					const incY = baseY - incH
					const expY = incY - GAP_PX - expH
					const savY = expY - GAP_PX - savH

					const showTip = (clientEvt: React.MouseEvent) => {
						const rect = (
							clientEvt.target as SVGRectElement
						).getBoundingClientRect()
						const cont = (clientEvt.currentTarget as SVGSVGElement)
							.closest('.relative')
							?.getBoundingClientRect()
						setTip({
							x: rect.left - (cont?.left ?? 0) + rect.width / 2,
							y: rect.top - (cont?.top ?? 0),
							text: `${monthLabel(d.month)} — zarobek ${fmt(d.income)}, wydatki ${fmt(d.expense)}, oszczędności ${fmt(
								d.saving,
							)}`,
						})
					}

					return (
						<g key={d.month} onMouseLeave={() => setTip(null)}>
							{d.income > 0 && (
								<rect
									x={cx - barW / 2}
									y={incY}
									width={barW}
									height={incH}
									rx={2.5}
									fill='var(--good)'
									className='cursor-pointer'
									onMouseEnter={showTip}
									onMouseMove={showTip}
									onClick={() => onBarClick?.(d.month)}
								/>
							)}
							{d.expense > 0 && (
								<rect
									x={cx - barW / 2}
									y={expY}
									width={barW}
									height={expH}
									rx={2.5}
									fill='var(--critical)'
									className='cursor-pointer'
									onMouseEnter={showTip}
									onMouseMove={showTip}
									onClick={() => onBarClick?.(d.month)}
								/>
							)}
							{d.saving > 0 && (
								<rect
									x={cx - barW / 2}
									y={savY}
									width={barW}
									height={savH}
									rx={2.5}
									fill='var(--cat1)'
									className='cursor-pointer'
									onMouseEnter={showTip}
									onMouseMove={showTip}
									onClick={() => onBarClick?.(d.month)}
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
						</g>
					)
				})}
			</svg>
			<div className='flex gap-3 justify-center pt-0.5'>
				<LegendItem color='var(--good)' label='Zarobek' />
				<LegendItem color='var(--critical)' label='Wydatki' />
				<LegendItem color='var(--cat1)' label='Oszczędności' />
			</div>
			{tip && (
				<div
					className='absolute pointer-events-none z-[5] bg-ink text-surface text-[11.5px] font-semibold px-2.5 py-1.5 rounded-md whitespace-nowrap tabular-nums'
					style={{
						left: tip.x,
						top: tip.y,
						transform: 'translate(-50%, -115%)',
					}}
				>
					{tip.text}
				</div>
			)}
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


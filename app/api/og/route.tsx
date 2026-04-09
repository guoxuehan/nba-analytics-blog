import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

type CategoryConfig = {
  bgFrom: string
  bgTo: string
  accent: string
  label: string
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  player_analysis: { bgFrom: '#1c0000', bgTo: '#4d0a0a', accent: '#e53e3e', label: 'PLAYER ANALYSIS' },
  team_analysis:   { bgFrom: '#0a1628', bgTo: '#153455', accent: '#3182ce', label: 'TEAM ANALYSIS' },
  tactics:         { bgFrom: '#0a150a', bgTo: '#172b17', accent: '#38a169', label: 'TACTICS' },
  data:            { bgFrom: '#090912', bgTo: '#191930', accent: '#805ad5', label: 'DATA' },
}

const DEFAULT_CONFIG: CategoryConfig = {
  bgFrom: '#0d0d0d',
  bgTo: '#1a1a1a',
  accent: '#c0392b',
  label: 'NBA',
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const title = searchParams.get('title') ?? 'NBA COURT VISION'
  const category = searchParams.get('category') ?? ''

  const cfg = CATEGORY_CONFIG[category] ?? DEFAULT_CONFIG

  // タイトルが長い場合は短縮（OGP画像に収まるよう）
  const displayTitle = title.length > 60 ? title.slice(0, 58) + '…' : title

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '72px 80px',
          background: `linear-gradient(155deg, ${cfg.bgFrom} 0%, ${cfg.bgTo} 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 右上の幾何学的デコレーション */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            right: '-80px',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            background: cfg.accent,
            opacity: 0.06,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '60px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            border: `2px solid ${cfg.accent}`,
            opacity: 0.15,
          }}
        />

        {/* 左側アクセントバー */}
        <div
          style={{
            position: 'absolute',
            left: '0',
            top: '0',
            bottom: '0',
            width: '6px',
            background: cfg.accent,
          }}
        />

        {/* サイト名（上部） */}
        <div
          style={{
            position: 'absolute',
            top: '52px',
            left: '80px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '3px',
              background: cfg.accent,
            }}
          />
          <span
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              fontFamily: 'sans-serif',
              textTransform: 'uppercase',
            }}
          >
            NBA COURT VISION
          </span>
        </div>

        {/* カテゴリバッジ */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 12px',
            background: cfg.accent,
            borderRadius: '2px',
            marginBottom: '20px',
            alignSelf: 'flex-start',
          }}
        >
          <span
            style={{
              color: '#fff',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.15em',
              fontFamily: 'sans-serif',
              textTransform: 'uppercase',
            }}
          >
            {cfg.label}
          </span>
        </div>

        {/* 記事タイトル */}
        <div
          style={{
            color: '#ffffff',
            fontSize: displayTitle.length > 40 ? '42px' : '50px',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            fontFamily: 'sans-serif',
            maxWidth: '960px',
            textShadow: '0 2px 20px rgba(0,0,0,0.4)',
          }}
        >
          {displayTitle}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

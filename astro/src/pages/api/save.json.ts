import type { APIRoute } from 'astro';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const prerender = false;

const contentPath = path.join(process.cwd(), 'src', 'data', 'content.json');
const docsIndexPath = path.resolve(process.cwd(), '..', 'docs', 'index.html');
const docsAeformlibPath = path.resolve(process.cwd(), '..', 'docs', 'aeformlib', 'index.html');
const docsMarketingPath = path.resolve(process.cwd(), '..', 'docs', 'marketing', 'index.html');
const docsStylesPath = path.resolve(process.cwd(), '..', 'docs', 'assets', 'styles.css');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isPrivateIpv4 = (hostname: string) => {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

const isEditorAllowedHost = (hostname: string) =>
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '::1'
  || hostname.endsWith('.local')
  || isPrivateIpv4(hostname);

export const POST: APIRoute = async ({ request }) => {
  try {
    const requestUrl = new URL(request.url);
    if (!isEditorAllowedHost(requestUrl.hostname)) {
      return new Response(JSON.stringify({ ok: false, error: 'editor disabled on this host' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await request.json();
    if (!payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({ ok: false, error: 'invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let existing = { text: {}, links: {}, cssVars: {} };
    try {
      const raw = await readFile(contentPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        existing = {
          text: parsed.text || {},
          links: parsed.links || {},
          cssVars: parsed.cssVars || {}
        };
      }
    } catch (err) {
      // 初回保存や読み込み失敗時は空のまま
    }

    const normalized = {
      text: { ...existing.text, ...(payload.text || {}) },
      links: { ...existing.links, ...(payload.links || {}) },
      cssVars: { ...existing.cssVars, ...(payload.cssVars || {}) }
    };

    const inlineOnlyIds = new Set([
      'heroSubtitle',
      'heroLead',
      'messageP1',
      'messageP2',
      'messageP3',
      'messageP4',
      'messageP5',
      'ctaBody',
      // aeformlib page (keep contenteditable from introducing <div>)
      'aeLead',
      'aeOutcome1',
      'aeOutcome2',
      'aeOutcome3',
      'aeValue1Body',
      'aeValue2Body',
      'aeValue3Body',
      'aeWhyP1',
      'aeWhyP2',
      'aeWhyP3',
      'aeFitL1',
      'aeFitL2',
      'aeFitL3',
      'aeFitR1',
      'aeFitR2',
      'aeFitR3',
      'aeFeat1Body',
      'aeFeat2Body',
      'aeFeat3Body',
      'aeCtaBody',
      // marketing page
      'mkHeroLead',
      'mkPainIntro',
      'mkPain1Copy',
      'mkPain2Copy',
      'mkPain3Copy',
      'mkPain4Copy',
      'mkPain5Copy',
      'mkPain6Copy',
      'mkVisualP1',
      'mkVisualP2',
      'mkVisualP3',
      'mkScope1Desc',
      'mkScope2Desc',
      'mkScope3Desc',
      'mkProcess1Desc',
      'mkProcess2Desc',
      'mkProcess3Desc',
      'mkDeliver1',
      'mkDeliver2',
      'mkDeliver3',
      'mkDeliver4',
      'mkDeliver5',
      'mkDeliver6',
      'mkProductDesc',
      'mkCtaBody'
    ]);
    const normalizeInlineHtml = (value: string) => value
      .replace(/<div[^>]*>/gi, '<br>')
      .replace(/<\/div>/gi, '')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '')
      .replace(/(<br>\s*){2,}/gi, '<br>')
      .replace(/^<br>/i, '');
    Object.keys(normalized.text).forEach((id) => {
      if (!inlineOnlyIds.has(id)) return;
      const raw = normalized.text[id];
      if (typeof raw !== 'string') return;
      normalized.text[id] = normalizeInlineHtml(raw);
    });

    await writeFile(contentPath, JSON.stringify(normalized, null, 2), 'utf-8');

    try {
      const updateHtmlFile = async (filePath: string) => {
        let html = await readFile(filePath, 'utf-8');
        const textEntries = Object.entries(normalized.text);
        for (const [id, value] of textEntries) {
          const safeId = escapeRegExp(id);
          const regex = new RegExp(`(<([a-zA-Z0-9-]+)[^>]*data-edit-id="${safeId}"[^>]*>)([\\s\\S]*?)(</\\2>)`, 'i');
          html = html.replace(regex, (_match, open, _tag, _inner, close) => `${open}${value}${close}`);
        }
        const linkEntries = Object.entries(normalized.links);
        for (const [key, href] of linkEntries) {
          const regex = new RegExp(`(<[^>]*data-edit-link="${key}"[^>]*href=)(["'])([^"']*)(["'])`, 'g');
          html = html.replace(regex, (match, prefix, quote, _old, suffix) => `${prefix}${quote}${href}${suffix}`);
        }
        await writeFile(filePath, html, 'utf-8');
      };

      await updateHtmlFile(docsIndexPath);
      await updateHtmlFile(docsAeformlibPath);
      await updateHtmlFile(docsMarketingPath);
    } catch (err) {
      // docs/index.html がない場合は無視
    }

    try {
      let css = await readFile(docsStylesPath, 'utf-8');
      for (const [varName, value] of Object.entries(normalized.cssVars)) {
        const regex = new RegExp(`(${varName}\\s*:\\s*)url\\([^;]*\\);`);
        css = css.replace(regex, `$1${value};`);
      }
      await writeFile(docsStylesPath, css, 'utf-8');
    } catch (err) {
      // docs/_assets/styles.css がない場合は無視
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: 'save failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

# TokenFinOps — Enterprise B2B AI API & Cloud Token FinOps Calculator

**TokenFinOps** is a production-ready, static-generated web application built with **Astro 5.x**, **React**, and **Tailwind CSS**. It serves as an enterprise financial operating engine for Staff Engineers, Engineering Directors, and FinOps practitioners to model and optimize Large Language Model (LLM) API unit economics.

Designed for high-RPM programmatic SEO (pSEO) and Google AdSense monetization with zero Cumulative Layout Shift (CLS = 0.00).

---

## ⚡ Key Architecture & Features

- **Framework:** Astro 5.x with Static Site Generation (`output: 'static'`)
- **Interactive UI Islands:** React with TypeScript (`client:load`)
- **Styling:** Enterprise B2B FinOps dashboard aesthetic (Tailwind CSS, dark mode native)
- **Deployment Target:** Netlify (`dist` directory, caching headers, security policies pre-configured in `netlify.toml`)
- **Zero Backend Cost:** 100% client-side deterministic calculation engine backed by static JSON datasets (`src/data/models.json` and `src/data/workloads.json`)
- **270+ Pre-Rendered Pages:** Complete programmatic SEO coverage for model comparisons, deep-dive pricing, and architecture workloads.

---

## 📐 Core FinOps Mathematical Engine

The calculation engine (`src/utils/finopsMath.ts`) models the 5 production variables governing modern LLM gross margins:

### 1. Unit Converter
- **Tokens:** Direct BPE token representation
- **Words:** `tokens = Math.ceil(words * 1.33)`
- **Characters:** `tokens = Math.ceil(chars / 4)`
- **Clean PDF Text:** `tokens = pages * 650`
- **Scanned PDF / OCR:** `tokens = pages * 1200`

### 2. Multi-Turn Conversation Compounding
For an $N$-turn session with System Prompt $S$, User Input per turn $U$, and Model Output per turn $O$:
$$\text{Session Input Tokens} = (N \times S) + \sum_{i=1}^{N} (i \times U + (i - 1) \times O)$$
$$\text{Peak Context Tokens} = S + (N \times U) + ((N - 1) \times O)$$
$$\text{Session Output Tokens} = N \times O$$

### 3. Context-Window Cliff Surcharge Detection
Detects when peak turn context crosses provider surcharge thresholds (e.g. 128,000 tokens for Gemini 2.5 Pro). Automatically switches to `longContextInputRatePer1M` and calculates the exact monthly dollar penalty. Alerts when requests exceed maximum context windows.

### 4. Prompt Caching & Batch Discounts
- Splits input tokens into fresh vs. cached read tokens using the configured `cacheHitPercent` (up to 95% SLA).
- Applies `cachedInputRatePer1M` for up to 90% savings on static system instructions and RAG prefixes.
- Supports 24-hour asynchronous Batch API toggle for a 50% discount on supported endpoints.

### 5. Smart Model Routing Recommender
Calculates the financial impact of hybrid semantic routing: automatically routes $X\%$ (default 70%) of simple queries to a designated budget model (`recommendedCheapAlternativeId`), outputting exact monthly and annualized run-rate savings.

---

## 🌐 Programmatic SEO Routes

1. **Homepage (`/`):**
   Full interactive FinOps calculator, 8 architectural workload blueprints, complete searchable directory of all 16 foundation models, and Technical SEO educational guides.
2. **Head-to-Head Comparisons (`/compare/[modelA]-vs-[modelB]-api-cost-calculator`):**
   240 static pre-rendered routes comparing unit economic rate variances, prompt caching ROI, break-even input-to-output token ratios, and side-by-side calculators.
3. **Single Model Deep Dives (`/models/[id]-pricing-calculator`):**
   16 dedicated model pages with pre-computed cost tier tables for 1k, 10k, 100k, and 1M daily requests.
4. **Workload Estimators (`/workloads/[slug]-cost-calculator`):**
   8 enterprise blueprints: RAG Pipeline, Support Chatbot, PR Review Bot, Bulk PDF Extraction, Meeting Summarizer, Text-to-SQL Analytics, Legal Contract Due Diligence, and E-Commerce Catalog Enrichment.
5. **Trust & AdSense Compliance:**
   `/privacy-policy`, `/terms`, `/about`, and `/contact`.

---

## 🛡️ Technical SEO & Monetization Infrastructure

- **Structured Data (JSON-LD):** Valid `SoftwareApplication` and data-driven `FAQPage` schema on every page.
- **CLS-Safe Ad Containers:** `<AdSlot />` component with reserved CSS heights (`90px` leaderboard, `250px` in-content MPU, `120px` footer) preventing layout shifts.
- **Sitemap & Robots:** `@astrojs/sitemap` generates `dist/sitemap-index.xml` and `dist/sitemap-0.xml` with all 270 pages. `robots.txt` and `ads.txt` pre-configured in `public/`.

---

## 🛠️ Development & Build Commands

```bash
# Install dependencies
npm install

# Run pure math engine test suite
npm run test:math

# Start local Astro development server
npm run dev

# Compile static HTML production build
npm run build

# Preview static build locally
npm run preview
```

---

## 🚀 Netlify Deployment

Build settings are pre-configured in `netlify.toml`:
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Cache headers:** Immutable 1-year cache for `/_astro/*` assets, security headers (`X-Frame-Options`, `X-Content-Type-Options`), and stale-while-revalidate for HTML.

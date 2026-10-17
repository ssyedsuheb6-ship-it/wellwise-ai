'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';

type Product = {
  id: string;
  name: string;
  variant: string | null;
  concern: string | null;
  size_label: string | null;
  key_ingredient: string | null;
  price_inr: number | null;
  mrp_inr: number | null;
  rating: number | null;
  option_count: number | null;
  stock_status: string | null;
  intended_use: string | null;
  directions: string | null;
  precautions: string | null;
  expected_results: string | null;
  source_url: string | null;
  verified_at: string | null;
  review_status: string;
};

type Checkin = {
  id: string;
  date: string;
  product: string;
  used: string;
  clear: string;
  note: string;
};

type Msg = { role: 'assistant' | 'user'; text: string; source?: string | null };
type Tab = 'guidance' | 'tracker' | 'assistant' | 'about';

const KEY = 'wellwise-checkins-v1';

function money(value: number | null) {
  if (value === null || value === undefined) return 'Not listed';
  return `₹${value.toLocaleString('en-IN')}`;
}

// Only add a URL here after confirming that it is the exact official Be Bodywise product page.
const VERIFIED_OFFICIAL_PRODUCT_URLS: Record<string, string> = {
  '1% Salicylic Acid Body Wash - 100 mL':
    'https://bebodywise.com/product/1-salicylic-acid-body-wash-100ml',
  '1% Ketoconazole Anti-Dandruff Shampoo (250ml)':
    'https://bebodywise.com/product/1-ketoconazole-dandruff-shampoo-250ml-xp',
};

function officialProductUrl(product: Product): string | null {
  const curated = VERIFIED_OFFICIAL_PRODUCT_URLS[product.name];
  if (curated) return curated;

  // Accept database URLs only when they point to Be Bodywise's official domain.
  if (product.source_url) {
    try {
      const url = new URL(product.source_url);
      if (url.protocol === 'https:' &&
          (url.hostname === 'bebodywise.com' || url.hostname === 'www.bebodywise.com') &&
          url.pathname.startsWith('/product/')) {
        return url.toString();
      }
    } catch {
      // Ignore malformed or non-HTTPS URLs.
    }
  }
  return null;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('guidance');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [notice, setNotice] = useState('');

  const [product, setProduct] = useState('');
  const [used, setUsed] = useState('yes');
  const [clear, setClear] = useState('yes');
  const [note, setNote] = useState('');

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: 'Hello. I can help explain available product information in plain English. Select a product first for product-specific questions. If verified guidance is unavailable, I will say so.',
    },
  ]);

  useEffect(() => {
    try {
      const value = localStorage.getItem(KEY);
      if (value) setCheckins(JSON.parse(value) as Checkin[]);
    } catch {
      // Ignore invalid local browser data.
    }
  }, []);

  useEffect(() => {
    let live = true;

    async function loadCatalogue() {
      if (!supabase) {
        if (live) {
          setCatalogueError('Supabase is not configured. Check the public Supabase environment variables in Vercel.');
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('product_catalogue_public')
        .select(
          'id,name,variant,concern,size_label,key_ingredient,price_inr,mrp_inr,rating,option_count,stock_status,intended_use,directions,precautions,expected_results,source_url,verified_at,review_status',
        )
        .order('name');

      if (!live) return;

      if (error) {
        setCatalogueError(`Catalogue could not load: ${error.message}`);
        setProducts([]);
      } else {
        setCatalogueError('');
        setProducts((data ?? []) as Product[]);
      }

      setLoading(false);
    }

    void loadCatalogue();
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return products;
    return products.filter((item) =>
      [
        item.name,
        item.variant,
        item.concern,
        item.size_label,
        item.key_ingredient,
        item.stock_status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [products, query]);

  function save(next: Checkin[]) {
    setCheckins(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setNotice('Saved in this browser only.');
    } catch {
      setNotice('Could not save in this browser. Check storage settings.');
    }
  }

  function submitCheckin(event: FormEvent) {
    event.preventDefault();
    if (!product.trim()) return;

    save([
      {
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        product: product.trim(),
        used,
        clear,
        note: note.trim(),
      },
      ...checkins,
    ]);
    setProduct('');
    setNote('');
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    setMessages((current) => [...current, { role: 'user', text: question }]);
    setInput('');
    setBusy(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, product: selected }),
      });

      const data = (await response.json()) as {
        answer?: string;
        error?: string;
        sourceUrl?: string | null;
      };

      if (!response.ok) throw new Error(data.error || 'Assistant unavailable.');

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: data.answer || 'No answer returned.',
          source: data.sourceUrl,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: error instanceof Error ? error.message : 'Assistant unavailable.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const nav: Tab[] = ['guidance', 'tracker', 'assistant', 'about'];
  const tabLabels: Record<Tab, string> = {
    guidance: 'Product guidance',
    tracker: 'My check-ins',
    assistant: 'Ask WELLWISE',
    about: 'About',
  };

  return (
    <main>
      <header className="shell top">
        <div className="brand">
          <b>W</b>wellwise<span style={{ color: '#71906f' }}> ai</span>
        </div>
        <nav className="nav" aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item}
              className={tab === item ? 'active' : ''}
              onClick={() => setTab(item)}
            >
              {tabLabels[item]}
            </button>
          ))}
        </nav>
        <span className="tag">
          {supabaseConfigured ? 'Catalogue connected' : 'Catalogue not connected'}
        </span>
      </header>

      <section className="shell hero">
        <div>
          <div className="eyebrow">A clearer product experience</div>
          <h1>
            Good guidance.
            <br />
            <span style={{ color: '#5f8067' }}>Less guesswork.</span>
          </h1>
          <p>
            Find products, review listed product details, understand what has been
            verified, and keep track of the questions that matter to you.
          </p>
        </div>
        <aside className="note">
          <strong>Clear product information. Clear verification status.</strong>
          <p className="muted">
            Catalogue listings help identify products. Product-specific guidance
            is shown only when it has been verified. WELLWISE AI is an independent
            project, not an official Be Bodywise service.
          </p>
        </aside>
      </section>

      <section className="shell">
        {notice && (
          <div className="notice" role="status">
            {notice}{' '}
            <button
              className="secondary"
              onClick={() => setNotice('')}
              style={{ float: 'right' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {tab === 'guidance' && (
          <>
            <div className="head">
              <div>
                <h2>Product catalogue</h2>
                <p className="muted">
                  Search by product name, concern, size, ingredient, or availability.
                </p>
              </div>
              <span className="tag">{products.length} catalogue entries</span>
            </div>

            <div className="grid">
              <section className="panel">
                <h3>Find your product</h3>
                <p className="muted">
                  Product listings and verification status are shown separately.
                </p>
                <div className="row">
                  <input
                    className="field"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, concern, size or ingredient"
                    aria-label="Search product catalogue"
                  />
                </div>

                {loading ? (
                  <div className="empty">
                    <h3>Loading catalogue</h3>
                    <p className="muted">Connecting to the product database.</p>
                  </div>
                ) : catalogueError ? (
                  <div className="empty" role="alert">
                    <h3>Catalogue connection problem</h3>
                    <p className="muted">{catalogueError}</p>
                    <p className="muted">
                      The database setup must be completed before products can load.
                    </p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="empty">
                    <h3>{products.length ? 'No matching products' : 'No products found'}</h3>
                    <p className="muted">
                      {products.length
                        ? 'Try another search term.'
                        : 'The public product catalogue is empty. Check that the catalogue SQL setup has been run in Supabase.'}
                    </p>
                  </div>
                ) : (
                  filtered.map((item) => {
                    const officialUrl = officialProductUrl(item);
                    return (
                      <div key={item.id}>
                        <button
                          className="secondary"
                          style={{
                            display: 'flex',
                            width: '100%',
                            justifyContent: 'space-between',
                            marginTop: 10,
                            textAlign: 'left',
                            gap: 12,
                          }}
                          onClick={() => setSelected(item)}
                        >
                          <span>
                            <strong>{item.name}</strong>
                            <br />
                            <span className="muted">
                              {[item.concern, item.size_label, item.key_ingredient]
                                .filter(Boolean)
                                .join(' · ') || item.variant || 'Product details listed'}
                            </span>
                          </span>
                          <span aria-hidden="true">↗</span>
                        </button>
                        {officialUrl ? (
                          <p style={{ margin: '4px 0 8px 4px' }}>
                            <a href={officialUrl} target="_blank" rel="noopener noreferrer">
                              View official product page ↗
                            </a>
                          </p>
                        ) : (
                          <p className="muted" style={{ margin: '4px 0 8px 4px', fontSize: 12 }}>
                            Official product link not verified yet.
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </section>

              <section className="panel">
                <h3>{selected?.name || 'Product details'}</h3>
                <p className="muted">
                  {selected
                    ? 'Catalogue details and verification status for this listing.'
                    : 'Choose a product to view its details.'}
                </p>

                {!selected ? (
                  <div className="empty">
                    <p className="muted">
                      Price, size, ingredients, availability and verification status
                      will appear here when provided in the catalogue.
                    </p>
                  </div>
                ) : (
                  <>
                    <span className="tag">
                      {selected.review_status === 'verified'
                        ? `Verified${selected.verified_at ? ` · checked ${selected.verified_at}` : ''}`
                        : selected.review_status === 'unavailable'
                          ? 'Currently marked unavailable'
                          : 'Guidance under review'}
                    </span>

                    <div className="detail">
                      <h4>Product details</h4>
                      <p><strong>Concern:</strong> {selected.concern || 'Not listed'}</p>
                      <p><strong>Size:</strong> {selected.size_label || 'Not listed'}</p>
                      <p><strong>Key ingredient:</strong> {selected.key_ingredient || 'Not listed'}</p>
                      <p><strong>Price:</strong> {money(selected.price_inr)}</p>
                      <p><strong>MRP:</strong> {money(selected.mrp_inr)}</p>
                      <p><strong>Rating:</strong> {selected.rating == null ? 'Not listed' : `${selected.rating}/5`}</p>
                      <p><strong>Options:</strong> {selected.option_count ?? 'Not listed'}</p>
                      <p><strong>Availability:</strong> {selected.stock_status || 'Not listed'}</p>
                    </div>

                    {selected.review_status === 'verified' ? (
                      <>
                        {[
                          ['Intended use', selected.intended_use],
                          ['Directions', selected.directions],
                          ['Precautions', selected.precautions],
                          ['Expected results', selected.expected_results],
                        ].map(([heading, value]) => (
                          <div className="detail" key={heading as string}>
                            <h4>{heading}</h4>
                            <p>{value || 'Not available in the verified catalogue.'}</p>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="muted">
                        This listing is visible for product identification. Product-specific
                        directions, precautions and claims are withheld until verified.
                      </p>
                    )}

                    {officialProductUrl(selected) ? (
                      <p>
                        <a
                          href={officialProductUrl(selected) as string}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View official product page ↗
                        </a>
                      </p>
                    ) : (
                      <p className="muted">
                        Official product link not verified yet. We will add it once the exact product page is confirmed.
                      </p>
                    )}
                    <button className="primary" onClick={() => setTab('assistant')}>
                      Ask about this product
                    </button>
                  </>
                )}
              </section>
            </div>
          </>
        )}

        {tab === 'tracker' && (
          <>
            <div className="head">
              <div>
                <h2>Your usage check-ins</h2>
                <p className="muted">Record what happened and what remains unclear.</p>
              </div>
              <span className="tag">{checkins.length} saved</span>
            </div>
            <div className="grid">
              <section className="panel">
                <h3>New check-in</h3>
                <p className="muted">Saved in this browser only. Not uploaded or shared.</p>
                <form className="stack" onSubmit={submitCheckin}>
                  <label className="label">
                    Product name
                    <input
                      className="field"
                      required
                      maxLength={120}
                      value={product}
                      onChange={(event) => setProduct(event.target.value)}
                      placeholder="Name printed on your product"
                    />
                  </label>
                  <label className="label">
                    Did you use it today?
                    <select className="field" value={used} onChange={(event) => setUsed(event.target.value)}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="prefer not to say">Prefer not to say</option>
                    </select>
                  </label>
                  <label className="label">
                    Were the instructions clear?
                    <select className="field" value={clear} onChange={(event) => setClear(event.target.value)}>
                      <option value="yes">Yes, clear</option>
                      <option value="partly">Partly clear</option>
                      <option value="no">No, unclear</option>
                    </select>
                  </label>
                  <label className="label">
                    Question or note (optional)
                    <textarea
                      className="field"
                      maxLength={1000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="A note for yourself"
                    />
                  </label>
                  <button className="primary">Save check-in</button>
                </form>
              </section>
              <section className="panel">
                <h3>Recent check-ins</h3>
                {checkins.length === 0 ? (
                  <div className="empty">
                    <p className="muted">Nothing recorded yet. Your entries will appear here.</p>
                  </div>
                ) : (
                  checkins.map((entry) => (
                    <div className="entry" key={entry.id}>
                      <strong>{entry.product}</strong>
                      <span className="tag" style={{ float: 'right' }}>{entry.date}</span>
                      <p>
                        Used: {entry.used} · Instructions:{' '}
                        {entry.clear === 'yes' ? 'clear' : entry.clear === 'partly' ? 'partly clear' : 'unclear'}
                        {entry.note ? ` · Note: ${entry.note}` : ''}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => save(checkins.filter((item) => item.id !== entry.id))}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </section>
            </div>
          </>
        )}

        {tab === 'assistant' && (
          <>
            <div className="head">
              <div>
                <h2>Ask WELLWISE</h2>
                <p className="muted">Plain-language explanations with clear limits.</p>
              </div>
              <span className="tag">AI assistant</span>
            </div>
            <div className="grid">
              <section className="panel">
                <h3>Conversation</h3>
                <p className="muted">
                  Selected product: {selected?.name || 'None selected'}. Choose one in Product guidance for product-specific context.
                </p>
                <div aria-live="polite">
                  {messages.map((message, index) => (
                    <div key={index} className={'message ' + (message.role === 'user' ? 'user' : '')}>
                      {message.role === 'assistant' ? (
                        <ReactMarkdown>
                          {message.text.replace(/\\([*_`])/g, '$1').replace(/\\:/g, ':').replace(/\\+$/gm, '')}
                        </ReactMarkdown>
                      ) : (
                        message.text
                      )}
                      {message.source && <p>Source: {message.source}</p>}
                    </div>
                  ))}
                  {busy && <div className="message">Checking available information…</div>}
                </div>
                <form className="row" onSubmit={ask}>
                  <input
                    className="field"
                    maxLength={1200}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask about instructions or precautions"
                  />
                  <button className="primary" disabled={busy || !input.trim()}>Send</button>
                </form>
                <div className="warning">
                  AI can be wrong and is not medical advice. Live answers require a server-side API key.
                </div>
              </section>
              <aside className="panel">
                <h3>How answers are handled</h3>
                <p className="muted">
                  The assistant should not invent directions, timelines or product claims.
                  Missing information should be identified rather than guessed.
                </p>
                <div className="detail">
                  <h4>Current product context</h4>
                  <p>{selected ? selected.name : 'No product selected.'}</p>
                </div>
                <div className="detail">
                  <h4>What this is not</h4>
                  <p>A diagnosis, official brand endorsement, or guarantee of product results.</p>
                </div>
              </aside>
            </div>
          </>
        )}

        {tab === 'about' && (
          <>
            <div className="head">
              <div>
                <h2>About WELLWISE AI</h2>
                <p className="muted">A clearer way to work with product information.</p>
              </div>
            </div>
            <div className="grid">
              <section className="panel">
                <h3>Our purpose</h3>
                <p className="muted">
                  WELLWISE AI helps people review available product information and record where they still have questions.
                </p>
                <div className="detail">
                  <h4>Information status</h4>
                  <p>Catalogue listings may be visible before guidance is verified. Product directions and claims are shown only for verified entries.</p>
                </div>
                <div className="detail">
                  <h4>Independence</h4>
                  <p>This is not an official Be Bodywise service and does not claim endorsement by Mosaic Wellness.</p>
                </div>
                <div className="detail">
                  <h4>Validation</h4>
                  <p>Usability and comprehension outcomes must be measured with real participants before improvement claims are made.</p>
                </div>
              </section>
              <aside className="panel">
                <h3>Privacy at a glance</h3>
                <p className="muted">Check-ins are saved in this browser using local storage. They do not sync across devices or upload to a server.</p>
                <div className="detail">
                  <h4>What not to enter</h4>
                  <p>Do not enter passwords, medical records, phone numbers, or another person's identifying information.</p>
                </div>
                <div className="detail">
                  <h4>AI questions</h4>
                  <p>If enabled, questions are sent to the configured AI provider. Do not enter sensitive personal information.</p>
                </div>
              </aside>
            </div>
          </>
        )}
      </section>

      <footer className="shell footer">
        <div>
          <strong>WELLWISE AI</strong>
          <br />
          Product guidance, made clearer.
        </div>
        <div>
          Independent project. Not an official Be Bodywise service.
          <br />
          Information availability varies. AI output is not medical advice.
        </div>
      </footer>
    </main>
  );
}

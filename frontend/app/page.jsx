import ClientApp from "./ClientApp";

// Server-rendered crawler-visible content. The interactive app is hydrated
// client-side via `<ClientApp />`. CliffWatch is a static export, so this
// markup is what crawlers (Googlebot, Bingbot, social previews) see before
// JavaScript executes.
export default function Page() {
  return (
    <>
      <section
        className="seo-static-content"
        aria-hidden="false"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <h1>UK CliffWatch — PolicyEngine benefit cliff explorer</h1>
        <p>
          UK CliffWatch is a free, open-source tool from PolicyEngine that maps
          benefit cliffs and effective marginal tax rates for UK households. Enter
          a household&apos;s region, composition and rent to see how net resources
          change as earnings rise — with the Universal Credit 55% taper, the
          High-Income Child Benefit Charge, and the £100,000 personal-allowance
          trap all highlighted along the curve.
        </p>
        <h2>What UK CliffWatch shows</h2>
        <ul>
          <li>Net household income as earnings rise</li>
          <li>Benefit cliffs where small earnings gains cause large net losses</li>
          <li>Effective marginal tax rates across the income distribution</li>
          <li>Program-level breakdowns for UK benefits and taxes</li>
          <li>Side-by-side comparisons across all 12 UK regions</li>
        </ul>
        <h2>Programs modelled</h2>
        <p>
          Universal Credit, Child Benefit, Child Tax Credit, Working Tax Credit,
          Housing Benefit, Council Tax Reduction, Pension Credit, Tax-Free
          Childcare, Free School Meals, Income Tax, National Insurance, and
          Council Tax.
        </p>
      </section>
      <ClientApp />
    </>
  );
}

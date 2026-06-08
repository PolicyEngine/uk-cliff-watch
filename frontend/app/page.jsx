import ClientApp from './ClientApp.jsx';

export default function Page() {
  return (
    <>
      <section className="visually-hidden" aria-hidden="true">
        <h1>UK CliffWatch — PolicyEngine benefit cliff and marginal tax rate explorer</h1>
        <p>
          UK CliffWatch visualises how the UK tax-and-benefit system interacts across the
          earnings spectrum, focusing on benefit cliffs, Universal Credit taper rates, and
          effective marginal tax rates (EMTRs). As earnings rise, households can face
          marginal rates above 70–80% because multiple benefits withdraw simultaneously
          while income tax and National Insurance are also deducted. CliffWatch maps these
          interactions for a range of household types, regions, and income levels.
        </p>
        <ul>
          <li>Net income and net-after-housing-costs as earned income rises from zero</li>
          <li>Effective marginal tax rate at each point on the earnings spectrum</li>
          <li>Benefit cliff locations — sharp drops in net income or sharp jumps in EMTR</li>
          <li>Program-by-program breakdown of benefits and taxes for a given household</li>
          <li>Regional comparison of net income across UK regions for the same household</li>
          <li>Impact of Universal Credit taper and work allowances on take-home pay</li>
        </ul>
      </section>

      <ClientApp />
    </>
  );
}

export interface SeedFormula {
  subjectCode: string;
  chapterCode: string;
  subtopicName: string | null;
  title: string;
  expression: string;
  notes: string;
  tags: string[];
}

const F = (
  subjectCode: string,
  chapterCode: string,
  subtopicName: string | null,
  title: string,
  expression: string,
  notes = "",
  tags: string[] = [],
): SeedFormula => ({ subjectCode, chapterCode, subtopicName, title, expression, notes, tags });

const PHYSICS_CONSTANTS = [
  F("PHYSICS", "units-measurements", null, "Acceleration due to gravity", String.raw`g \approx 9.8\ \mathrm{m\,s^{-2}}`, "Use 10 m s⁻² only when the question permits.", ["constant"]),
  F("PHYSICS", "units-measurements", null, "Universal gravitational constant", String.raw`G = 6.674\times10^{-11}\ \mathrm{N\,m^2\,kg^{-2}}`, "", ["constant"]),
  F("PHYSICS", "units-measurements", null, "Elementary charge", String.raw`e = 1.602\times10^{-19}\ \mathrm{C}`, "", ["constant"]),
  F("PHYSICS", "units-measurements", null, "Electron mass", String.raw`m_e = 9.109\times10^{-31}\ \mathrm{kg}`, "", ["constant"]),
  F("PHYSICS", "units-measurements", null, "Permittivity of free space", String.raw`\varepsilon_0 = 8.854\times10^{-12}\ \mathrm{F\,m^{-1}}`, "", ["constant"]),
  F("PHYSICS", "units-measurements", null, "Permeability of free space", String.raw`\mu_0 = 4\pi\times10^{-7}\ \mathrm{N\,A^{-2}}`, "", ["constant"]),
  F("PHYSICS", "units-measurements", null, "Planck constant", String.raw`h = 6.626\times10^{-34}\ \mathrm{J\,s}`, "", ["constant"]),
  F("PHYSICS", "units-measurements", null, "Speed of light in vacuum", String.raw`c = 3.00\times10^8\ \mathrm{m\,s^{-1}}`, "", ["constant"]),
];

export const FORMULA_SEED: SeedFormula[] = [
  ...PHYSICS_CONSTANTS,

  // Physics: units and errors
  F("PHYSICS", "units-measurements", "SI units and dimensional formulae", "Dimensional formula of force", String.raw`[F]=[MLT^{-2}]`, "Derive from F = ma.", ["dimensions"]),
  F("PHYSICS", "units-measurements", "Significant figures and error propagation", "Error in a sum or difference", String.raw`\Delta Z=\Delta A+\Delta B`, "Add absolute errors.", ["errors"]),
  F("PHYSICS", "units-measurements", "Significant figures and error propagation", "Relative error of a product", String.raw`\frac{\Delta Z}{Z}=\frac{\Delta A}{A}+\frac{\Delta B}{B}`, "Add fractional errors for products and quotients.", ["errors"]),
  F("PHYSICS", "units-measurements", "Significant figures and error propagation", "Relative error of a power", String.raw`\frac{\Delta Z}{Z}=n\frac{\Delta A}{A}`, "For Z = Aⁿ.", ["errors"]),

  // Physics: kinematics
  F("PHYSICS", "kinematics", "Motion in a straight line", "First equation of motion", String.raw`v=u+at`, "Uniform acceleration only.", ["motion"]),
  F("PHYSICS", "kinematics", "Motion in a straight line", "Second equation of motion", String.raw`s=ut+\frac12at^2`, "", ["motion"]),
  F("PHYSICS", "kinematics", "Motion in a straight line", "Third equation of motion", String.raw`v^2=u^2+2as`, "", ["motion"]),
  F("PHYSICS", "kinematics", "Motion in a straight line", "Stopping distance", String.raw`s_{\text{stop}}=\frac{u^2}{2\mu g}`, "Level road with kinetic friction μ.", ["friction"]),
  F("PHYSICS", "kinematics", "Relative velocity", "Relative velocity", String.raw`\vec v_{AB}=\vec v_A-\vec v_B`, "", ["relative"]),
  F("PHYSICS", "kinematics", "Projectile motion", "Horizontal and vertical projectile motion", String.raw`x=u\cos\theta\,t,\qquad y=u\sin\theta\,t-\frac12gt^2`, "", ["projectile"]),
  F("PHYSICS", "kinematics", "Projectile motion", "Projectile trajectory", String.raw`y=x\tan\theta-\frac{gx^2}{2u^2\cos^2\theta}`, "The equation of the parabolic path.", ["projectile"]),
  F("PHYSICS", "kinematics", "Projectile motion", "Horizontal range", String.raw`R=\frac{u^2\sin2\theta}{g}`, "Maximum at θ = 45°.", ["projectile"]),
  F("PHYSICS", "kinematics", "Projectile motion", "Maximum height", String.raw`H=\frac{u^2\sin^2\theta}{2g}`, "", ["projectile"]),
  F("PHYSICS", "kinematics", "Projectile motion", "Time of flight", String.raw`T=\frac{2u\sin\theta}{g}`, "", ["projectile"]),
  F("PHYSICS", "kinematics", "Uniform circular motion", "Centripetal acceleration", String.raw`a_c=\frac{v^2}{r}=\omega^2r`, "", ["circular"]),

  // Physics: laws of motion
  F("PHYSICS", "laws-of-motion", "Newton's laws and free-body diagrams", "Newton's second law", String.raw`\vec F_{\text{net}}=m\vec a`, "Vector equation.", ["newton"]),
  F("PHYSICS", "laws-of-motion", "Friction", "Friction force", String.raw`f_s\le\mu_sN,\qquad f_k=\mu_kN`, "Static friction is self-adjusting.", ["friction"]),
  F("PHYSICS", "laws-of-motion", "Dynamics of circular motion", "Banking of a road", String.raw`\tan\theta=\frac{v^2}{rg}`, "Ideal bank angle, no friction.", ["circular"]),
  F("PHYSICS", "laws-of-motion", "Dynamics of circular motion", "Conical pendulum period", String.raw`T=2\pi\sqrt{\frac{L\cos\theta}{g}}`, "", ["circular"]),
  F("PHYSICS", "laws-of-motion", "Dynamics of circular motion", "Vertical circle minimum speeds", String.raw`v_{\text{top,min}}=\sqrt{gR},\qquad v_{\text{bottom,min}}=\sqrt{5gR}`, "Minimum speed to complete the circle.", ["circular"]),

  // Physics: energy
  F("PHYSICS", "work-energy-power", "Work done by constant and variable forces", "Work done by a force", String.raw`W=\vec F\cdot\vec s=Fs\cos\theta`, "", ["work"]),
  F("PHYSICS", "work-energy-power", "Kinetic and potential energy", "Kinetic energy", String.raw`K=\frac12mv^2`, "", ["energy"]),
  F("PHYSICS", "work-energy-power", "Kinetic and potential energy", "Spring potential energy", String.raw`U=\frac12kx^2`, "", ["energy"]),
  F("PHYSICS", "work-energy-power", "Conservation of mechanical energy", "Work-energy theorem", String.raw`W_{\text{net}}=\Delta K`, "", ["energy"]),
  F("PHYSICS", "work-energy-power", "Power", "Instantaneous power", String.raw`P=\frac{dW}{dt}=\vec F\cdot\vec v`, "", ["power"]),

  // Physics: COM and momentum
  F("PHYSICS", "centre-of-mass-momentum", "Centre of mass of systems and bodies", "Centre of mass", String.raw`\vec r_{\mathrm{cm}}=\frac{\sum m_i\vec r_i}{\sum m_i}`, "", ["com"]),
  F("PHYSICS", "centre-of-mass-momentum", "Impulse and momentum conservation", "Impulse-momentum theorem", String.raw`\vec J=\int\vec F\,dt=\Delta\vec p`, "", ["momentum"]),
  F("PHYSICS", "centre-of-mass-momentum", "Elastic and inelastic collisions", "1D elastic collision velocities", String.raw`v_1'=\frac{m_1-m_2}{m_1+m_2}u_1+\frac{2m_2}{m_1+m_2}u_2,\quad v_2'=\frac{2m_1}{m_1+m_2}u_1+\frac{m_2-m_1}{m_1+m_2}u_2`, "Equal masses exchange velocities.", ["collision"]),
  F("PHYSICS", "centre-of-mass-momentum", "Elastic and inelastic collisions", "Coefficient of restitution", String.raw`e=\frac{v_2'-v_1'}{u_1-u_2}`, "e = 1 elastic, e = 0 perfectly inelastic.", ["collision"]),

  // Physics: rotation
  F("PHYSICS", "rotational-motion", "Torque and rotational dynamics", "Torque", String.raw`\vec\tau=\vec r\times\vec F=I\alpha`, "", ["rotation"]),
  F("PHYSICS", "rotational-motion", "Moment of inertia and radius of gyration", "Common moments of inertia", String.raw`I_{\text{ring}}=MR^2,\quad I_{\text{disc}}=\frac12MR^2,\quad I_{\text{solid sphere}}=\frac25MR^2,\quad I_{\text{rod}}=\frac{ML^2}{12}`, "About the stated central axes.", ["inertia"]),
  F("PHYSICS", "rotational-motion", "Moment of inertia and radius of gyration", "Parallel-axis theorem", String.raw`I=I_{\mathrm{cm}}+Md^2`, "", ["inertia"]),
  F("PHYSICS", "rotational-motion", "Angular momentum", "Angular momentum", String.raw`\vec L=I\vec\omega=\vec r\times\vec p`, "Conserved when external torque is zero.", ["angular-momentum"]),
  F("PHYSICS", "rotational-motion", "Rolling motion", "Rolling kinetic energy", String.raw`K=\frac12mv_{\mathrm{cm}}^2+\frac12I_{\mathrm{cm}}\omega^2,\qquad v_{\mathrm{cm}}=\omega R`, "", ["rolling"]),

  // Physics: gravitation
  F("PHYSICS", "gravitation", "Newton's law of gravitation", "Newton's law of gravitation", String.raw`F=\frac{Gm_1m_2}{r^2}`, "", ["gravity"]),
  F("PHYSICS", "gravitation", "Gravity inside and near bodies", "Acceleration due to gravity", String.raw`g=\frac{GM}{R^2},\qquad g_h\approx g\left(1-\frac{2h}{R}\right)`, "", ["gravity"]),
  F("PHYSICS", "gravitation", "Gravitational potential and energy", "Gravitational potential", String.raw`V=-\frac{GM}{r}`, "", ["gravity"]),
  F("PHYSICS", "gravitation", "Gravitational potential and energy", "Escape velocity", String.raw`v_e=\sqrt{\frac{2GM}{R}}=\sqrt{2gR}`, "", ["gravity"]),
  F("PHYSICS", "gravitation", "Satellites and orbits", "Orbital speed and period", String.raw`v_o=\sqrt{\frac{GM}{r}},\qquad T^2=\frac{4\pi^2r^3}{GM}`, "", ["orbit"]),

  // Physics: solids and fluids
  F("PHYSICS", "mechanical-properties-solids", "Young's modulus", "Young's modulus", String.raw`Y=\frac{F/A}{\Delta L/L}=\frac{FL}{A\Delta L}`, "", ["elasticity"]),
  F("PHYSICS", "mechanical-properties-solids", "Elastic potential energy", "Elastic energy density", String.raw`u=\frac12\,\text{stress}\times\text{strain}=\frac{\sigma^2}{2Y}`, "", ["elasticity"]),
  F("PHYSICS", "mechanical-properties-fluids", "Pressure and Pascal's law", "Hydrostatic pressure", String.raw`P=P_0+\rho gh`, "", ["fluid"]),
  F("PHYSICS", "mechanical-properties-fluids", "Buoyancy and Archimedes' principle", "Buoyant force", String.raw`F_b=\rho_{\text{fluid}}V_{\text{sub}}g`, "", ["fluid"]),
  F("PHYSICS", "mechanical-properties-fluids", "Bernoulli's theorem and applications", "Continuity equation", String.raw`A_1v_1=A_2v_2`, "Incompressible steady flow.", ["fluid"]),
  F("PHYSICS", "mechanical-properties-fluids", "Bernoulli's theorem and applications", "Bernoulli's equation", String.raw`P+\frac12\rho v^2+\rho gh=\text{constant}`, "Ideal, non-viscous, streamline flow.", ["fluid"]),
  F("PHYSICS", "mechanical-properties-fluids", "Viscosity and Stokes' law", "Terminal velocity", String.raw`v_t=\frac{2r^2(\rho-\sigma)g}{9\eta}`, "", ["viscosity"]),
  F("PHYSICS", "mechanical-properties-fluids", "Surface tension and capillarity", "Capillary rise", String.raw`h=\frac{2T\cos\theta}{r\rho g}`, "", ["surface-tension"]),

  // Physics: thermal
  F("PHYSICS", "thermal-properties", "Thermal expansion", "Linear expansion", String.raw`\Delta L=L\alpha\Delta T`, "Area ≈ 2α, volume ≈ 3α.", ["thermal"]),
  F("PHYSICS", "thermal-properties", "Calorimetry and phase changes", "Heat and latent heat", String.raw`Q=mc\Delta T,\qquad Q=mL`, "", ["thermal"]),
  F("PHYSICS", "thermal-properties", "Conduction", "Steady-state conduction", String.raw`\frac{Q}{t}=\frac{kA(T_1-T_2)}{L}`, "", ["thermal"]),
  F("PHYSICS", "thermal-properties", "Wien's and Stefan's laws", "Stefan-Boltzmann and Wien laws", String.raw`P=\sigma A T^4,\qquad \lambda_mT=b`, "", ["radiation"]),

  // Physics: thermodynamics
  F("PHYSICS", "thermodynamics", "First law of thermodynamics", "First law of thermodynamics", String.raw`\Delta U=Q-W`, "W is work done by the gas in this convention.", ["thermo"]),
  F("PHYSICS", "thermodynamics", "Thermodynamic processes", "Isothermal work", String.raw`W=nRT\ln\frac{V_2}{V_1}`, "", ["thermo"]),
  F("PHYSICS", "thermodynamics", "Thermodynamic processes", "Adiabatic relations", String.raw`PV^\gamma=\text{constant},\qquad TV^{\gamma-1}=\text{constant}`, "", ["thermo"]),
  F("PHYSICS", "thermodynamics", "Heat engines and refrigerators", "Carnot efficiency and refrigerator COP", String.raw`\eta=1-\frac{T_C}{T_H},\qquad \mathrm{COP}=\frac{T_C}{T_H-T_C}`, "Temperatures in kelvin.", ["thermo"]),

  // Physics: kinetic theory
  F("PHYSICS", "kinetic-theory", "Kinetic molecular theory", "Ideal gas equation", String.raw`PV=nRT,\qquad PV=Nk_BT`, "", ["gas-law"]),
  F("PHYSICS", "kinetic-theory", "Kinetic molecular theory", "RMS speed", String.raw`v_{\mathrm{rms}}=\sqrt{\frac{3RT}{M}}=\sqrt{\frac{3k_BT}{m}}`, "", ["kinetic-theory"]),
  F("PHYSICS", "kinetic-theory", "Mean free path and transport", "Mean free path", String.raw`\lambda=\frac{1}{\sqrt2\pi d^2 n}`, "", ["kinetic-theory"]),

  // Physics: oscillations and waves
  F("PHYSICS", "oscillations", "Simple harmonic motion", "SHM displacement and velocity", String.raw`x=A\sin(\omega t+\phi),\qquad v=A\omega\cos(\omega t+\phi),\qquad a=-\omega^2x`, "", ["SHM"]),
  F("PHYSICS", "oscillations", "Spring-mass systems", "Spring period", String.raw`T=2\pi\sqrt{\frac{m}{k}}`, "", ["SHM"]),
  F("PHYSICS", "oscillations", "Simple pendulum and physical pendulum", "Simple pendulum period", String.raw`T=2\pi\sqrt{\frac{L}{g}}`, "Small oscillations.", ["SHM"]),
  F("PHYSICS", "oscillations", "Energy in SHM", "SHM energy", String.raw`E=\frac12kA^2`, "", ["SHM"]),
  F("PHYSICS", "waves", "Wave equation and wave speed", "Wave relation", String.raw`v=f\lambda`, "", ["waves"]),
  F("PHYSICS", "waves", "Wave equation and wave speed", "Speed of a transverse wave on a string", String.raw`v=\sqrt{\frac{T}{\mu}}`, "", ["waves"]),
  F("PHYSICS", "waves", "Standing waves", "Standing wave frequencies", String.raw`f_n=\frac{n}{2L}\sqrt{\frac{T}{\mu}}\ \text{(string)},\qquad f_n=\frac{nv}{2L}\ \text{(open pipe)},\qquad f_n=\frac{(2n-1)v}{4L}\ \text{(closed pipe)}`, "", ["standing-waves"]),
  F("PHYSICS", "waves", "Beats and resonance", "Beat frequency", String.raw`f_{\text{beat}}=|f_1-f_2|`, "", ["beats"]),
  F("PHYSICS", "waves", "Doppler effect", "Doppler effect", String.raw`f'=f\frac{v\pm v_o}{v\mp v_s}`, "Choose signs from the relative motion.", ["doppler"]),

  // Physics: electrostatics
  F("PHYSICS", "electrostatics", "Coulomb's law and superposition", "Coulomb's law", String.raw`F=\frac{1}{4\pi\varepsilon_0}\frac{q_1q_2}{r^2}`, "", ["electrostatics"]),
  F("PHYSICS", "electrostatics", "Electric field and field lines", "Electric field of a point charge", String.raw`E=\frac{1}{4\pi\varepsilon_0}\frac{|q|}{r^2}`, "", ["electrostatics"]),
  F("PHYSICS", "electrostatics", "Electric potential and potential energy", "Potential of a point charge", String.raw`V=\frac{1}{4\pi\varepsilon_0}\frac{q}{r}`, "", ["electrostatics"]),
  F("PHYSICS", "electrostatics", "Gauss's law", "Gauss's law", String.raw`\oint\vec E\cdot d\vec A=\frac{q_{\mathrm{in}}}{\varepsilon_0}`, "", ["gauss"]),
  F("PHYSICS", "electrostatics", "Capacitance and capacitor combinations", "Parallel plate capacitance", String.raw`C=\frac{\varepsilon_0 A}{d}`, "", ["capacitor"]),
  F("PHYSICS", "electrostatics", "Dielectrics and energy storage", "Capacitor energy", String.raw`U=\frac12CV^2=\frac{Q^2}{2C}`, "", ["capacitor"]),
  F("PHYSICS", "electrostatics", "Capacitance and capacitor combinations", "Capacitor series and parallel", String.raw`\frac1{C_s}=\sum\frac1{C_i},\qquad C_p=\sum C_i`, "", ["capacitor"]),

  // Physics: current
  F("PHYSICS", "current-electricity", "Ohm's law and resistivity", "Ohm's law and resistance", String.raw`V=IR,\qquad R=\frac{\rho L}{A}`, "", ["current"]),
  F("PHYSICS", "current-electricity", "Ohm's law and resistivity", "Drift velocity", String.raw`I=nAev_d`, "", ["current"]),
  F("PHYSICS", "current-electricity", "Electrical power and heating", "Electrical power", String.raw`P=VI=I^2R=\frac{V^2}{R}`, "", ["power"]),
  F("PHYSICS", "current-electricity", "Wheatstone bridge and potentiometer", "Wheatstone balance", String.raw`\frac{P}{Q}=\frac{R}{S}`, "", ["bridge"]),

  // Physics: magnetism
  F("PHYSICS", "moving-charges-magnetism", "Lorentz force", "Lorentz force", String.raw`\vec F=q(\vec E+\vec v\times\vec B)`, "", ["magnetism"]),
  F("PHYSICS", "moving-charges-magnetism", "Motion in a magnetic field", "Radius of circular motion", String.raw`r=\frac{mv}{qB}=\frac{p}{qB}`, "", ["magnetism"]),
  F("PHYSICS", "moving-charges-magnetism", "Biot-Savart law", "Field of a long straight wire", String.raw`B=\frac{\mu_0I}{2\pi r}`, "", ["magnetism"]),
  F("PHYSICS", "moving-charges-magnetism", "Ampere's circuital law", "Field of a solenoid", String.raw`B=\mu_0nI`, "", ["magnetism"]),
  F("PHYSICS", "moving-charges-magnetism", "Force on current-carrying conductors", "Torque on a current loop", String.raw`\tau=NIAB\sin\theta`, "", ["magnetism"]),

  // Physics: EMI and AC
  F("PHYSICS", "electromagnetic-induction", "Faraday's law and Lenz's law", "Faraday's law", String.raw`\mathcal{E}=-\frac{d\Phi_B}{dt}`, "", ["induction"]),
  F("PHYSICS", "electromagnetic-induction", "Motional EMF", "Motional EMF", String.raw`\mathcal{E}=B\ell v`, "", ["induction"]),
  F("PHYSICS", "electromagnetic-induction", "Self and mutual inductance", "Inductor EMF and energy", String.raw`\mathcal{E}=-L\frac{dI}{dt},\qquad U=\frac12LI^2`, "", ["inductance"]),
  F("PHYSICS", "alternating-current", "RLC series circuits", "Series RLC impedance", String.raw`Z=\sqrt{R^2+(X_L-X_C)^2},\qquad X_L=\omega L,\qquad X_C=\frac1{\omega C}`, "", ["AC"]),
  F("PHYSICS", "alternating-current", "RLC series circuits", "Resonance frequency", String.raw`\omega_0=\frac1{\sqrt{LC}},\qquad f_0=\frac1{2\pi\sqrt{LC}}`, "", ["AC"]),
  F("PHYSICS", "alternating-current", "Power in AC circuits", "Average AC power", String.raw`P_{\mathrm{avg}}=V_{\mathrm{rms}}I_{\mathrm{rms}}\cos\varphi`, "", ["AC"]),
  F("PHYSICS", "alternating-current", "Transformers", "Transformer relation", String.raw`\frac{V_s}{V_p}=\frac{N_s}{N_p}=\frac{I_p}{I_s}`, "Ideal transformer.", ["AC"]),
  F("PHYSICS", "electromagnetic-waves", "Properties of electromagnetic waves", "Speed and field ratio", String.raw`c=\frac1{\sqrt{\mu_0\varepsilon_0}},\qquad \frac{E_0}{B_0}=c`, "", ["EM-wave"]),

  // Physics: optics
  F("PHYSICS", "ray-optics", "Reflection and spherical mirrors", "Mirror formula", String.raw`\frac1f=\frac1v+\frac1u,\qquad m=-\frac vu`, "Use the sign convention consistently.", ["optics"]),
  F("PHYSICS", "ray-optics", "Refraction at spherical surfaces and lenses", "Lens formula and lensmaker's equation", String.raw`\frac1f=\frac1v-\frac1u,\qquad \frac1f=(n-1)\left(\frac1{R_1}-\frac1{R_2}\right)`, "", ["optics"]),
  F("PHYSICS", "ray-optics", "Refraction and total internal reflection", "Snell's law and critical angle", String.raw`n_1\sin\theta_1=n_2\sin\theta_2,\qquad \sin\theta_c=\frac{n_2}{n_1}`, "", ["optics"]),
  F("PHYSICS", "ray-optics", "Prisms and dispersion", "Thin prism deviation", String.raw`\delta=(n-1)A`, "Small angle A.", ["optics"]),
  F("PHYSICS", "wave-optics", "Interference and Young's double slit", "YDSE fringe width", String.raw`\beta=\frac{\lambda D}{d}`, "", ["interference"]),
  F("PHYSICS", "wave-optics", "Diffraction", "Single-slit minima", String.raw`a\sin\theta=n\lambda`, "", ["diffraction"]),
  F("PHYSICS", "wave-optics", "Polarisation", "Brewster's law", String.raw`\tan\theta_p=\frac{n_2}{n_1}`, "", ["polarisation"]),

  // Physics: modern physics
  F("PHYSICS", "dual-nature", "Photon theory and applications", "Photon energy and momentum", String.raw`E=hf=\frac{hc}{\lambda},\qquad p=\frac{h}{\lambda}`, "", ["photon"]),
  F("PHYSICS", "dual-nature", "Photoelectric effect", "Photoelectric equation", String.raw`K_{\max}=hf-\phi`, "", ["photoelectric"]),
  F("PHYSICS", "dual-nature", "de Broglie waves", "de Broglie wavelength", String.raw`\lambda=\frac{h}{p}=\frac{h}{mv}`, "", ["matter-wave"]),
  F("PHYSICS", "atoms-nuclei", "Bohr model of the hydrogen atom", "Bohr radius and energy", String.raw`r_n=0.529\frac{n^2}{Z}\ \text{Å},\qquad E_n=-13.6\frac{Z^2}{n^2}\ \text{eV}`, "", ["atom"]),
  F("PHYSICS", "atoms-nuclei", "Hydrogen spectrum", "Rydberg formula", String.raw`\frac1\lambda=R\left(\frac1{n_1^2}-\frac1{n_2^2}\right)`, "", ["spectrum"]),
  F("PHYSICS", "atoms-nuclei", "Radioactivity", "Radioactive decay", String.raw`N=N_0e^{-\lambda t},\qquad T_{1/2}=\frac{\ln2}{\lambda}`, "", ["radioactivity"]),
  F("PHYSICS", "atoms-nuclei", "Nuclear reactions, fission and fusion", "Mass-energy equivalence", String.raw`E=\Delta mc^2`, "", ["nuclear"]),
  F("PHYSICS", "semiconductor-electronics", "Transistors and amplifiers", "Transistor current relation and gain", String.raw`I_E=I_B+I_C,\qquad \beta=\frac{I_C}{I_B}`, "", ["transistor"]),

  // Chemistry: basic and atomic
  F("CHEMISTRY", "some-basic-concepts", "Mole concept and molar mass", "Mole relation", String.raw`n=\frac{m}{M}=\frac{N}{N_A}`, "", ["mole"]),
  F("CHEMISTRY", "some-basic-concepts", "Concentration terms", "Molarity, molality and mole fraction", String.raw`M=\frac{n_{\text{solute}}}{V_{\text{solution}}(L)},\qquad m=\frac{n_{\text{solute}}}{m_{\text{solvent}}(kg)},\qquad x_i=\frac{n_i}{n_{\text{total}}}`, "", ["concentration"]),
  F("CHEMISTRY", "some-basic-concepts", "Concentration terms", "Dilution and normality", String.raw`M_1V_1=M_2V_2,\qquad N_1V_1=N_2V_2`, "Valid without reaction for dilution.", ["concentration"]),
  F("CHEMISTRY", "some-basic-concepts", null, "Avogadro's number", String.raw`N_A=6.022\times10^{23}\ \mathrm{mol^{-1}}`, "", ["constant"]),
  F("CHEMISTRY", "some-basic-concepts", null, "Universal gas constant", String.raw`R=8.314\ \mathrm{J\,mol^{-1}K^{-1}}=0.0821\ \mathrm{L\,atm\,mol^{-1}K^{-1}}`, "", ["constant"]),
  F("CHEMISTRY", "some-basic-concepts", null, "Molar volume at STP", String.raw`V_m=22.4\ \mathrm{L\,mol^{-1}}\ \text{at STP}`, "", ["constant"]),
  F("CHEMISTRY", "atomic-structure", "Bohr model and hydrogen spectrum", "Bohr energy and Rydberg", String.raw`E_n=-13.6\frac{Z^2}{n^2}\ \text{eV},\qquad \frac1\lambda=R_H\left(\frac1{n_1^2}-\frac1{n_2^2}\right)`, "", ["atomic"]),
  F("CHEMISTRY", "atomic-structure", "Wave-particle duality and uncertainty", "de Broglie and Heisenberg", String.raw`\lambda=\frac{h}{mv},\qquad \Delta x\,\Delta p\ge\frac{h}{4\pi}`, "", ["atomic"]),
  F("CHEMISTRY", "chemical-bonding", "Covalent bonds and VSEPR", "Formal charge", String.raw`\text{Formal charge}=\text{valence }e^--\text{nonbonding }e^--\frac12\text{bonding }e^-`, "", ["bonding"]),
  F("CHEMISTRY", "chemical-bonding", "Molecular orbital theory", "Bond order", String.raw`\text{Bond order}=\frac{N_b-N_a}{2}`, "", ["bonding"]),

  // Chemistry: thermodynamics, solutions, equilibrium
  F("CHEMISTRY", "chemical-thermodynamics", "Enthalpy and thermochemistry", "Enthalpy change at constant pressure", String.raw`\Delta H=\Delta U+\Delta n_gRT`, "", ["thermo"]),
  F("CHEMISTRY", "chemical-thermodynamics", "Gibbs free energy", "Gibbs free energy", String.raw`\Delta G=\Delta H-T\Delta S`, "Spontaneous if ΔG < 0.", ["thermo"]),
  F("CHEMISTRY", "chemical-thermodynamics", "Gibbs free energy", "Standard Gibbs energy and equilibrium", String.raw`\Delta G^\circ=-RT\ln K`, "", ["thermo"]),
  F("CHEMISTRY", "solutions", "Raoult's law and vapour pressure", "Raoult's law", String.raw`P_{\text{solution}}=x_{\text{solvent}}P^\circ_{\text{solvent}}`, "", ["solutions"]),
  F("CHEMISTRY", "solutions", "Colligative properties", "Boiling and freezing point changes", String.raw`\Delta T_b=iK_bm,\qquad \Delta T_f=iK_fm`, "", ["colligative"]),
  F("CHEMISTRY", "solutions", "Osmotic pressure", "Osmotic pressure", String.raw`\pi=iCRT`, "", ["colligative"]),
  F("CHEMISTRY", "equilibrium", "Equilibrium calculations", "Kp and Kc", String.raw`K_p=K_c(RT)^{\Delta n_g}`, "", ["equilibrium"]),
  F("CHEMISTRY", "equilibrium", "Ionic equilibrium and pH", "pH and pOH", String.raw`pH=-\log[H^+],\qquad pOH=-\log[OH^-],\qquad pH+pOH=14\ \text{at 25°C}`, "", ["ionic"]),
  F("CHEMISTRY", "equilibrium", "Buffers and salt hydrolysis", "Henderson-Hasselbalch equation", String.raw`pH=pK_a+\log\frac{[\text{base}]}{[\text{acid}]}`, "", ["buffer"]),
  F("CHEMISTRY", "equilibrium", "Solubility product", "Solubility product", String.raw`K_{sp}=[\text{cation}]^m[\text{anion}]^n`, "", ["solubility"]),

  // Chemistry: electrochemistry, kinetics
  F("CHEMISTRY", "electrochemistry", "Nernst equation", "Nernst equation", String.raw`E=E^\circ-\frac{0.0591}{n}\log Q\ \text{at 25°C}`, "", ["electrochem"]),
  F("CHEMISTRY", "electrochemistry", "Galvanic cells and EMF", "Cell EMF and Gibbs energy", String.raw`\Delta G^\circ=-nFE^\circ_{\text{cell}}`, "", ["electrochem"]),
  F("CHEMISTRY", "electrochemistry", "Conductance and Kohlrausch's law", "Molar conductivity", String.raw`\Lambda_m=\frac{1000\kappa}{M}`, "", ["electrochem"]),
  F("CHEMISTRY", "electrochemistry", "Electrolysis and Faraday's laws", "Faraday's first law", String.raw`m=\frac{ZIt}{1}=\frac{M}{nF}It`, "", ["electrochem"]),
  F("CHEMISTRY", "electrochemistry", null, "Faraday constant", String.raw`F=96485\ \mathrm{C\,mol^{-1}}`, "", ["constant"]),
  F("CHEMISTRY", "chemical-kinetics", "Integrated rate equations", "First-order integrated rate law", String.raw`k=\frac{2.303}{t}\log\frac{[A]_0}{[A]}`, "", ["kinetics"]),
  F("CHEMISTRY", "chemical-kinetics", "Half-life", "First-order half-life", String.raw`t_{1/2}=\frac{0.693}{k}`, "", ["kinetics"]),
  F("CHEMISTRY", "chemical-kinetics", "Arrhenius equation", "Arrhenius equation", String.raw`k=Ae^{-E_a/RT},\qquad \ln\frac{k_2}{k_1}=\frac{E_a}{R}\left(\frac1{T_1}-\frac1{T_2}\right)`, "", ["kinetics"]),
  F("CHEMISTRY", "coordination-compounds", "Crystal field theory", "Crystal field splitting energy", String.raw`\Delta_o=10Dq`, "CFSE depends on d-electron configuration and geometry.", ["coordination"]),
  F("CHEMISTRY", "coordination-compounds", "Werner's theory and nomenclature", "EAN rule", String.raw`\text{EAN}=Z-\text{oxidation state}+2\times\text{coordination number}`, "", ["coordination"]),
  F("CHEMISTRY", "organic-basics", "Structural and stereoisomerism", "Degree of unsaturation", String.raw`\text{DoU}=\frac{2C+2+N-H-X}{2}`, "", ["organic"]),

  // Mathematics: algebra and calculus
  F("MATHEMATICS", "complex-numbers-quadratic", "Quadratic equations", "Quadratic formula", String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`, "", ["quadratic"]),
  F("MATHEMATICS", "complex-numbers-quadratic", "Theory of equations", "Sum and product of roots", String.raw`\alpha+\beta=-\frac ba,\qquad \alpha\beta=\frac ca`, "", ["quadratic"]),
  F("MATHEMATICS", "complex-numbers-quadratic", "Complex algebra", "Modulus and argument", String.raw`|z|=\sqrt{x^2+y^2},\qquad z=r(\cos\theta+i\sin\theta)`, "", ["complex"]),
  F("MATHEMATICS", "complex-numbers-quadratic", "Roots of unity and de Moivre's theorem", "de Moivre's theorem", String.raw`(\cos\theta+i\sin\theta)^n=\cos n\theta+i\sin n\theta`, "", ["complex"]),
  F("MATHEMATICS", "matrices-determinants", "Adjoint and inverse", "Inverse of a matrix", String.raw`A^{-1}=\frac{\operatorname{adj}A}{|A|},\qquad |A|\ne0`, "", ["matrix"]),
  F("MATHEMATICS", "matrices-determinants", "Determinants and properties", "2×2 determinant and area", String.raw`\begin{vmatrix}a&b\\c&d\end{vmatrix}=ad-bc,\qquad \text{Area}=\frac12|ad-bc|`, "", ["determinant"]),
  F("MATHEMATICS", "permutations-combinations", "Permutations", "Permutations and combinations", String.raw`{}^nP_r=\frac{n!}{(n-r)!},\qquad {}^nC_r=\frac{n!}{r!(n-r)!}`, "", ["counting"]),
  F("MATHEMATICS", "permutations-combinations", "Circular permutations and restrictions", "Circular permutations", String.raw`\text{Circular arrangements}=(n-1)!`, "", ["counting"]),
  F("MATHEMATICS", "binomial-theorem", "Binomial expansion", "General term of a binomial expansion", String.raw`T_{r+1}={}^nC_r a^{n-r}b^r`, "", ["binomial"]),
  F("MATHEMATICS", "sequences-series", "Arithmetic progression", "AP term and sum", String.raw`a_n=a+(n-1)d,\qquad S_n=\frac n2[2a+(n-1)d]`, "", ["series"]),
  F("MATHEMATICS", "sequences-series", "Geometric progression", "GP term, finite sum and infinite sum", String.raw`a_n=ar^{n-1},\qquad S_n=a\frac{1-r^n}{1-r},\qquad S_\infty=\frac a{1-r}\ (|r|<1)`, "", ["series"]),
  F("MATHEMATICS", "limits-continuity-differentiability", "Standard limits and expansions", "Standard limits", String.raw`\lim_{x\to0}\frac{\sin x}{x}=1,\qquad \lim_{x\to0}\frac{e^x-1}{x}=1,\qquad \lim_{x\to0}\frac{\ln(1+x)}{x}=1`, "", ["limits"]),
  F("MATHEMATICS", "limits-continuity-differentiability", "Standard limits and expansions", "Binomial and exponential expansions", String.raw`e^x=\sum_{n=0}^\infty\frac{x^n}{n!},\qquad (1+x)^n=1+nx+\frac{n(n-1)}{2!}x^2+\cdots`, "", ["series"]),
  F("MATHEMATICS", "limits-continuity-differentiability", "Differentiability", "Derivative definition", String.raw`f'(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}h`, "", ["derivative"]),
  F("MATHEMATICS", "limits-continuity-differentiability", "Differentiability", "Derivative rules", String.raw`(fg)'=f'g+fg',\quad \left(\frac fg\right)'=\frac{f'g-fg'}{g^2},\quad \frac{d}{dx}f(g(x))=f'(g(x))g'(x)`, "", ["derivative"]),
  F("MATHEMATICS", "limits-continuity-differentiability", "Differentiability", "Standard derivatives", String.raw`\frac{d}{dx}x^n=nx^{n-1},\quad \frac{d}{dx}\sin x=\cos x,\quad \frac{d}{dx}\cos x=-\sin x,\quad \frac{d}{dx}\tan x=\sec^2x`, "", ["derivative"]),
  F("MATHEMATICS", "limits-continuity-differentiability", "Differentiability", "Exponential and logarithmic derivatives", String.raw`\frac{d}{dx}e^x=e^x,\qquad \frac{d}{dx}\ln x=\frac1x,\qquad \frac{d}{dx}a^x=a^x\ln a`, "", ["derivative"]),
  F("MATHEMATICS", "applications-derivatives", "Tangent and normal", "Tangent and normal to a curve", String.raw`y-y_1=f'(x_1)(x-x_1),\qquad \text{normal slope}=-\frac1{f'(x_1)}`, "", ["derivative"]),
  F("MATHEMATICS", "applications-derivatives", "Maxima and minima", "First and second derivative tests", String.raw`f'(x)=0,\qquad f''(x)>0\Rightarrow\text{minimum},\qquad f''(x)<0\Rightarrow\text{maximum}`, "", ["maxima"]),
  F("MATHEMATICS", "integration", "Indefinite integrals", "Power rule for integration", String.raw`\int x^n\,dx=\frac{x^{n+1}}{n+1}+C\ (n\ne-1),\qquad \int\frac{dx}{x}=\ln|x|+C`, "", ["integral"]),
  F("MATHEMATICS", "integration", "Indefinite integrals", "Standard integrals", String.raw`\int e^xdx=e^x+C,\quad \int\sin x\,dx=-\cos x+C,\quad \int\cos x\,dx=\sin x+C,\quad \int\sec^2x\,dx=\tan x+C`, "", ["integral"]),
  F("MATHEMATICS", "integration", "Integration by parts", "Integration by parts", String.raw`\int u\,dv=uv-\int v\,du`, "Choose u by ILATE.", ["integral"]),
  F("MATHEMATICS", "integration", "Definite integrals and properties", "Definite integral properties", String.raw`\int_a^bf(x)dx=\int_a^bf(a+b-x)dx,\qquad \int_{-a}^af(x)dx=2\int_0^af(x)dx\ \text{if }f\text{ is even}`, "", ["integral"]),
  F("MATHEMATICS", "applications-integrals", "Area under curves", "Area under a curve", String.raw`A=\int_a^b|f(x)|\,dx`, "", ["area"]),
  F("MATHEMATICS", "differential-equations", "Linear differential equations", "Linear differential equation solution", String.raw`\frac{dy}{dx}+Py=Q\Rightarrow y e^{\int Pdx}=\int Q e^{\int Pdx}dx+C`, "", ["ODE"]),
  F("MATHEMATICS", "straight-lines", "Slope and equations of lines", "Slope and line equations", String.raw`m=\frac{y_2-y_1}{x_2-x_1},\qquad y-y_1=m(x-x_1),\qquad \frac xa+\frac yb=1`, "", ["line"]),
  F("MATHEMATICS", "straight-lines", "Distance of a point from a line", "Distance from a line", String.raw`d=\frac{|Ax_1+By_1+C|}{\sqrt{A^2+B^2}}`, "", ["line"]),
  F("MATHEMATICS", "circles", "Equation of a circle", "Circle equation", String.raw`(x-h)^2+(y-k)^2=r^2,\qquad x^2+y^2+2gx+2fy+c=0`, "", ["circle"]),
  F("MATHEMATICS", "conic-sections", "Parabola", "Standard parabola", String.raw`y^2=4ax,\qquad \text{latus rectum}=4a`, "", ["conic"]),
  F("MATHEMATICS", "conic-sections", "Ellipse", "Standard ellipse", String.raw`\frac{x^2}{a^2}+\frac{y^2}{b^2}=1,\qquad e=\sqrt{1-\frac{b^2}{a^2}}\ (a>b)`, "", ["conic"]),
  F("MATHEMATICS", "conic-sections", "Hyperbola", "Standard hyperbola", String.raw`\frac{x^2}{a^2}-\frac{y^2}{b^2}=1,\qquad e=\sqrt{1+\frac{b^2}{a^2}}`, "", ["conic"]),
  F("MATHEMATICS", "three-d-geometry", "Planes", "Plane equation and distance", String.raw`ax+by+cz=d,\qquad d=\frac{|ax_1+by_1+cz_1-d|}{\sqrt{a^2+b^2+c^2}}`, "", ["3D"]),
  F("MATHEMATICS", "vectors", "Dot product", "Dot product", String.raw`\vec a\cdot\vec b=ab\cos\theta=a_1b_1+a_2b_2+a_3b_3`, "", ["vector"]),
  F("MATHEMATICS", "vectors", "Cross product", "Cross product", String.raw`|\vec a\times\vec b|=ab\sin\theta,\qquad \vec a\times\vec b=\begin{vmatrix}\hat i&\hat j&\hat k\\a_1&a_2&a_3\\b_1&b_2&b_3\end{vmatrix}`, "", ["vector"]),
  F("MATHEMATICS", "vectors", "Scalar triple product", "Scalar triple product", String.raw`[\vec a\ \vec b\ \vec c]=\vec a\cdot(\vec b\times\vec c)`, "Its absolute value is the parallelepiped volume.", ["vector"]),
  F("MATHEMATICS", "trigonometry", "Trigonometric identities", "Pythagorean and double-angle identities", String.raw`\sin^2x+\cos^2x=1,\qquad \sin2x=2\sin x\cos x,\qquad \cos2x=\cos^2x-\sin^2x`, "", ["trig"]),
  F("MATHEMATICS", "trigonometry", "Trigonometric identities", "Sum and product identities", String.raw`\sin(A\pm B)=\sin A\cos B\pm\cos A\sin B,\qquad \cos(A\pm B)=\cos A\cos B\mp\sin A\sin B`, "", ["trig"]),
  F("MATHEMATICS", "trigonometry", "Solution of triangles", "Sine and cosine rules", String.raw`\frac a{\sin A}=\frac b{\sin B}=\frac c{\sin C},\qquad c^2=a^2+b^2-2ab\cos C`, "", ["trig"]),
  F("MATHEMATICS", "trigonometry", "Inverse trigonometric functions", "Inverse trig identities", String.raw`\sin^{-1}x+\cos^{-1}x=\frac\pi2,\qquad \tan^{-1}x+\cot^{-1}x=\frac\pi2`, "", ["trig"]),
  F("MATHEMATICS", "statistics-probability", "Variance and standard deviation", "Variance", String.raw`\sigma^2=\frac1n\sum(x_i-\bar x)^2=\frac1n\sum x_i^2-\bar x^2`, "", ["statistics"]),
  F("MATHEMATICS", "statistics-probability", "Conditional probability and independence", "Conditional probability", String.raw`P(A\mid B)=\frac{P(A\cap B)}{P(B)}`, "", ["probability"]),
  F("MATHEMATICS", "statistics-probability", "Bayes' theorem", "Bayes' theorem", String.raw`P(A_i\mid B)=\frac{P(B\mid A_i)P(A_i)}{\sum_jP(B\mid A_j)P(A_j)}`, "", ["probability"]),
  F("MATHEMATICS", "statistics-probability", "Random variables and binomial distribution", "Binomial distribution", String.raw`P(X=r)={}^nC_rp^r(1-p)^{n-r},\qquad E(X)=np,\qquad \operatorname{Var}(X)=np(1-p)`, "", ["probability"]),
];

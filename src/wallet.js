const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function animateAmount(render, from, to, duration = 575) {
  if (reducedMotion() || from === to) {
    render(to);
    return () => {};
  }
  let start;
  let animation;
  function step(timestamp) {
    start ??= timestamp;
    const progress = Math.min(1, (timestamp - start) / duration);
    render(Math.round(from + (to - from) * (1 - (1 - progress) ** 3)));
    if (progress < 1) animation = requestAnimationFrame(step);
  }
  animation = requestAnimationFrame(step);
  return () => cancelAnimationFrame(animation);
}

function burst(container) {
  if (reducedMotion()) return;
  for (let i = 0; i < 7; i++) {
    const offset = i * Math.PI * 2 / 7 + 0.2;
    const particle = document.createElement('span');
    particle.className = 'wallet-particle';
    container.append(particle);
    const motion = particle.animate([
      { opacity: 0, transform: 'translate(0, 0) scale(.35)' },
      { opacity: 1, offset: 0.22 },
      { opacity: 0, transform: `translate(${Math.cos(offset) * (22 + i * 1.8)}px, ${Math.sin(offset) * 20}px) scale(.16)` },
    ], { duration: 550, easing: 'ease-out' });
    motion.onfinish = () => particle.remove();
  }
}

export function createWallet(wallet, format) {
  const amount = wallet.querySelector('#balance');
  let target;
  let shown;
  let cancel;
  let pulse;
  return next => {
    wallet.setAttribute('aria-label', format(next));
    if (target === next) {
      amount.textContent = format(shown);
      return;
    }
    const old = target;
    target = next;
    cancel?.();
    const render = value => {
      shown = value;
      amount.textContent = format(value);
    };
    if (old === undefined || !wallet.offsetWidth || reducedMotion()) {
      render(next);
      return;
    }
    wallet.dataset.direction = next > old ? 'gain' : 'spend';
    clearTimeout(pulse);
    pulse = setTimeout(() => { delete wallet.dataset.direction; }, 680);
    burst(wallet.querySelector('.wallet-icon'));
    cancel = animateAmount(render, shown, next);
  };
}

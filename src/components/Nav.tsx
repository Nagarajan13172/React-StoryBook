import { NavLink } from 'react-router-dom';
import './Nav.css';

export interface NavItem {
  to: string;
  label: string;
}

export interface NavProps {
  /** Navigation links, in order. Defaults to the demo app's routes. */
  items?: NavItem[];
}

const DEFAULT_ITEMS: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/products', label: 'Products' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/login', label: 'Sign in' },
];

/**
 * Primary site navigation. Renders a real <nav> landmark with an accessible
 * name; each link is a react-router <NavLink> that marks itself
 * `aria-current="page"` when active.
 */
export function Nav({ items = DEFAULT_ITEMS }: NavProps) {
  return (
    <nav className="ws-nav" aria-label="Primary">
      <ul className="ws-nav__list">
        {items.map((item) => (
          <li key={item.to} className="ws-nav__item">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `ws-nav__link${isActive ? ' ws-nav__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

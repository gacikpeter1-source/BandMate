// Router helpers that add the band's address prefix, so pages just say to="/band" and it works
// both on a band's own domain ("/band") and through the BandMate address ("/b/<bandId>/band").
import {
  Link as RLink,
  NavLink as RNavLink,
  Navigate as RNavigate,
  useNavigate as useRNavigate,
  type LinkProps,
  type NavLinkProps,
  type NavigateProps,
  type To,
} from "react-router-dom";
import { useTenant } from "../state/tenant";

const withBase = (base: string, to: To): To =>
  typeof to === "string" && to.startsWith("/") ? (base + (to === "/" ? "" : to) || "/") : to;

export function Link(props: LinkProps) {
  const { base } = useTenant();
  return <RLink {...props} to={withBase(base, props.to)} />;
}
export function NavLink(props: NavLinkProps) {
  const { base } = useTenant();
  return <RNavLink {...props} to={withBase(base, props.to)} />;
}
export function Navigate(props: NavigateProps) {
  const { base } = useTenant();
  return <RNavigate {...props} to={withBase(base, props.to)} />;
}
export function useNavigate() {
  const { base } = useTenant();
  const nav = useRNavigate();
  return (to: string) => nav(withBase(base, to));
}

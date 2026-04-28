import React from "react";

export type FooterLink = {
  label: string;
  href: string;
  src: string;
};

export interface FooterProps {
  links?: FooterLink[];
}

const defaultLinks: FooterLink[] = [
  { label: "ICHB", href: "https://portal.ichb.pl/homepage/", src: "/logo-ichb.png" },
  { label: "PP", href: "https://put.poznan.pl/en", src: "/logo-pp.svg" },
  { label: "RNAPolis", href: "https://rnapolis.pl/", src: "/logo-rnapolis.svg" },
];

const Footer: React.FC<FooterProps> = ({ links = defaultLinks }) => {
  return (
    <footer className="w-full border-t border-slate-200 bg-white shadow-[0_-6px_16px_rgba(0,0,0,0.08)] max-h-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {links.slice(0, 3).map((link) => (
            <a
              key={link.label}
              href={link.href}
              title={link.label}
              className="flex min-h-16 items-center justify-center rounded-xl  px-4 py-3 text-center transition hover:-translate-y-0.5 "
            >
              <img
                src={link.src}
                alt={link.label}
                className="h-12 w-auto max-w-[180px] object-contain"
              />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;

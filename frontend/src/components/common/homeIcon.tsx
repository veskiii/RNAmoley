import { NavLink } from "react-router-dom";

const navBaseClass = "whitespace-nowrap hover:text-teal-600";

const HomeIcon = () => {
  return (
    <div
      className="justify-start flex flex-row items-center gap-4 pl-2 text-md font-medium z-[2000] transition-colors"
    >
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `${navBaseClass} ${isActive ? "font-bold" : "font-medium"}`
        }
      >
        Home
      </NavLink>
      <NavLink
        to="/help"
        className={({ isActive }) =>
          `${navBaseClass} ${isActive ? "font-bold" : ""}`.trim()
        }
      >
        Help
      </NavLink>
      <NavLink
        to="/about"
        className={({ isActive }) =>
          `${navBaseClass} ${isActive ? "font-bold" : ""}`.trim()
        }
      >
        About
      </NavLink>
      <NavLink
        to="/cite"
        className={({ isActive }) =>
          `${navBaseClass} ${isActive ? "font-bold" : ""}`.trim()
        }
      >
        Cite Us
      </NavLink>
    </div>
  );
};

export default HomeIcon;

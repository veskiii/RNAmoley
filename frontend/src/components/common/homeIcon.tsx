// import { FaHome } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const HomeIcon = () => {
  const navigate = useNavigate();

  return (
    <div
      className="justify-center flex flex-row items-center pl-2 text-md font-md z-[2000] font-medium cursor-pointer transition-colors hover:text-teal-600"
      onClick={() => navigate("/")}
    >
      {/* <FaHome style={{ width: '2em', height: '2em', marginRight: '0.5em'}} /> */}
      Submition Panel
    </div>
  );
};

export default HomeIcon;

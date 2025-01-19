import { IoIosHelpCircleOutline } from "react-icons/io";
import { useNavigate } from "react-router-dom";

const HelpIcon = () => {
      const navigate = useNavigate();
    return (
        <div className="absolute bottom-0 right-0 justify-end flex flex-col items-end p-4 z-[2000]">
            <IoIosHelpCircleOutline style={{ width: '2em', height: '2em', cursor: "pointer" }} onClick={() => navigate("/help")} />
        </div>
    );
};

export default HelpIcon;
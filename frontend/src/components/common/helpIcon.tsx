import { IoIosHelpCircleOutline } from "react-icons/io";
import { useNavigate } from "react-router-dom";

const HelpIcon = () => {
    const navigate = useNavigate();
    return (
        <div className="justify-center flex flex-row items-center pl-2 z-[2000] font-medium cursor-pointer transition-colors hover:text-teal-600"
        onClick={() => navigate("/help")} 
        >
            <IoIosHelpCircleOutline style={{ width: '2em', height: '2em', marginRight: '0.5em' }}/>
                Help
        </div>
    );
};

export default HelpIcon;
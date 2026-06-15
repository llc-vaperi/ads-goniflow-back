import { UserService } from "../services/user.service.js";
export class UserController {
    userService = new UserService();
    getAllUsers = async (req, res, next) => {
        try {
            const users = await this.userService.getUsers();
            res.status(200).json({ success: true, data: users });
        }
        catch (error) {
            next(error);
        }
    };
    createUser = async (req, res, next) => {
        try {
            const { name, email } = req.body;
            if (!name || !email) {
                res.status(400).json({ success: false, error: "Name and email are required" });
                return;
            }
            const newUser = await this.userService.createUser({ name, email });
            res.status(201).json({ success: true, data: newUser });
        }
        catch (error) {
            next(error);
        }
    };
}

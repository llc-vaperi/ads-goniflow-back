export class UserService {
    // Mock user database in memory
    users = [
        { id: 1, name: "John Doe", email: "john@example.com" },
        { id: 2, name: "Jane Smith", email: "jane@example.com" },
    ];
    async getUsers() {
        return this.users;
    }
    async createUser(input) {
        const newUser = {
            id: this.users.length + 1,
            name: input.name,
            email: input.email,
        };
        this.users.push(newUser);
        return newUser;
    }
}

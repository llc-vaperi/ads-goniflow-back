import { Request, Response } from "express";

export function testFunc(req: Request, res: Response){
    res.json("test route");
};

import neo4j, { type Driver } from "neo4j-driver";

let _driver: Driver | null = null;

export function getDriver(): Driver {
    if (!_driver) {
        _driver = neo4j.driver(
            process.env.NEO4J_URI!,
            neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
        );
    }
    return _driver;
}